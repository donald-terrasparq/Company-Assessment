/**
 * Process one job: budget check → identify → gather → extract → score →
 * persist (docs/01-ARCHITECTURE.md data flow). Domain logic only — scheduling
 * lives in driver.ts.
 */
import { estimateTokenCostUsd, WEB_SEARCH_COST_PER_SEARCH_USD } from "@/lib/anthropic/models";
import { extractSignals, normalizePlaySteps } from "@/lib/anthropic/extract";
import { findCompanyById, setCompanyDomain } from "@/lib/db/queries/lists";
import { claimJobs, markJobDone, markJobFailed, releaseJob, type ClaimedJob } from "@/lib/db/queries/jobs";
import { getSettings } from "@/lib/db/queries/settings";
import { upsertCompanyResult } from "@/lib/db/queries/results";
import { completeRunIfDrained, findRunById, markRunHaltedBudget } from "@/lib/db/queries/runs";
import { logUsage, monthToDateCostUsd } from "@/lib/db/queries/usage";
import { db } from "@/lib/db/client";
import { signalProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { enrichCompany } from "@/lib/research/enrich";
import { isApolloConfigured } from "@/lib/apollo/client";
import { searchBestContactsRelaxed } from "@/lib/apollo/contacts";
import { parseContactPrefs } from "@/lib/apollo/prefs";
import { getActiveCompanyProfile } from "@/lib/db/queries/company-profiles";
import { enrichOrganization, newsForOrganization, type ApolloOrgData } from "@/lib/apollo/organization";
import { addApolloContacts, setResultContactFilters } from "@/lib/db/queries/contacts";
import { gather } from "@/lib/research/gather";
import { resolveDomain } from "@/lib/research/identify";
import { shouldCorrectDomain } from "@/lib/normalize/domain";
import { resolveSearchProvider } from "@/lib/search";
import { scoreCompany } from "@/lib/scoring/score";
import type { WeightProfile } from "@/lib/scoring/default-weights";

export { claimJobs, completeRunIfDrained };
export type { ClaimedJob };

/**
 * Budget cap (hard rule 6): checked before any spend for this job. Over cap →
 * run is halted, the claim is released without burning an attempt.
 */
export async function isOverBudget(): Promise<boolean> {
  const settings = await getSettings();
  const cap = Number(settings?.monthlyBudgetUsd ?? 100);
  const spent = await monthToDateCostUsd();
  return spent >= cap;
}

export async function processCompany(job: ClaimedJob): Promise<void> {
  const now = new Date();
  try {
    if (await isOverBudget()) {
      await markRunHaltedBudget(job.runId);
      await releaseJob(job.id);
      console.log(`worker: run ${job.runId} halted — monthly budget cap reached`);
      return;
    }

    const [run, company] = await Promise.all([
      findRunById(job.runId),
      findCompanyById(job.companyId),
    ]);
    if (!run || !company) throw new Error("run or company not found");
    if (run.status === "halted_budget" || run.status === "failed") {
      await releaseJob(job.id);
      return;
    }

    const profileRows = await db
      .select()
      .from(signalProfiles)
      .where(eq(signalProfiles.id, run.signalProfileId))
      .limit(1);
    const weights = profileRows[0]?.weights as WeightProfile | undefined;
    if (!weights) throw new Error("signal profile not found");

    // two-pass mode: pass-2 jobs carry a high-accuracy model override
    const model = job.modelOverride ?? run.model;
    const passLabel = job.pass === 2 ? " [pass 2 · high accuracy]" : "";
    const t0 = Date.now();
    const stageTimes: string[] = [];
    const mark = (stage: string, since: number) =>
      stageTimes.push(`${stage} ${((Date.now() - since) / 1000).toFixed(1)}s`);

    const provider = resolveSearchProvider(run.searchProvider);
    const useWebSearchTool = provider === null;

    // ---- stage 1: identity — resolve the domain if the list didn't provide one ----
    let domain = company.domain;
    let domainSource = company.domainSource;
    if (!domain && provider) {
      const hqHint =
        typeof company.rawRow === "object" && company.rawRow !== null
          ? String(
              (company.rawRow as Record<string, unknown>).hq ??
                (company.rawRow as Record<string, unknown>).city ??
                "",
            ) || null
          : null;
      const tIdentify = Date.now();
      const resolved = await resolveDomain({
        companyName: company.name,
        hqHint,
        model,
        provider,
      });
      mark("identify", tIdentify);
      if (resolved.usage.inputTokens > 0) {
        await logUsage({
          runId: run.id,
          companyId: company.id,
          provider: "anthropic",
          inputTokens: resolved.usage.inputTokens,
          outputTokens: resolved.usage.outputTokens,
          costUsd: estimateTokenCostUsd(
            model,
            resolved.usage.inputTokens,
            resolved.usage.outputTokens,
          ),
        });
      }
      if (resolved.usage.searches > 0) {
        await logUsage({
          runId: run.id,
          companyId: company.id,
          provider: provider.name,
          searches: resolved.usage.searches,
          costUsd: resolved.usage.searches * provider.costPerSearchUsd,
        });
      }
      if (resolved.domain) {
        domain = resolved.domain;
        domainSource = "lookup";
        await setCompanyDomain(company.id, resolved.domain, "lookup");
      }
    }

    // ---- stage 1b: free enrichment (registries, news, job boards, contracts) ----
    // runs for every provider path; all $0, every connector failure-tolerant
    const tEnrich = Date.now();
    const enrichment = await enrichCompany(company.name, domain, now);
    mark("enrich", tEnrich);
    if (enrichment.officialDomain) {
      if (!domain) {
        // registry-sourced official website — better than nothing, flagged as lookup
        domain = enrichment.officialDomain;
        domainSource = "lookup";
        await setCompanyDomain(company.id, enrichment.officialDomain, "lookup");
      } else if (
        domain !== enrichment.officialDomain &&
        shouldCorrectDomain(company.name, domain, enrichment.officialDomain)
      ) {
        // uploaded domain looks like a typo of the registry's official site
        // (mcirocenter.com → microcenter.com) — correct it, flagged as lookup
        console.log(
          `worker: ${company.name} — correcting uploaded domain ${domain} → ${enrichment.officialDomain}`,
        );
        domain = enrichment.officialDomain;
        domainSource = "lookup";
        await setCompanyDomain(company.id, enrichment.officialDomain, "lookup");
      }
    }

    // ---- stage 1c: Apollo org enrichment + news (approved #1 and #2) ----
    // gated on the admin toggle + key; failure-tolerant like every connector
    let apolloOrg: ApolloOrgData | null = null;
    let apolloNews: Awaited<ReturnType<typeof newsForOrganization>> = [];
    const settings = await getSettings();
    if (settings?.apolloEnabled && isApolloConfigured() && domain) {
      const tApollo = Date.now();
      try {
        apolloOrg = await enrichOrganization(domain);
        if (apolloOrg.orgId) {
          apolloNews = await newsForOrganization(apolloOrg.orgId, now).catch(() => []);
        }
        await logUsage({
          runId: run.id,
          companyId: company.id,
          provider: "apollo",
          searches: 1 + (apolloNews.length > 0 ? 1 : 0),
          costUsd: 0, // org enrichment + news consume no export credits
        });
      } catch (err) {
        console.log(
          `worker: ${company.name} — apollo enrichment skipped: ${err instanceof Error ? err.message : err}`,
        );
      }
      mark("apollo", tApollo);
    }
    if (apolloOrg) enrichment.facts.push(...apolloOrg.facts);

    // ---- stage 2: gather sources (skipped when the anthropic tool searches) ----
    let sources: Awaited<ReturnType<typeof gather>>["hits"] = [];
    if (provider) {
      const tGather = Date.now();
      const gathered = await gather({ companyName: company.name, provider, now });
      mark(`gather(${gathered.searches}q)`, tGather);
      sources = gathered.hits;
      if (gathered.searches > 0 || gathered.secSearches > 0) {
        await logUsage({
          runId: run.id,
          companyId: company.id,
          provider: provider.name,
          searches: gathered.searches,
          costUsd: gathered.searchCostUsd,
        });
        if (gathered.secSearches > 0) {
          await logUsage({
            runId: run.id,
            companyId: company.id,
            provider: "sec_edgar",
            searches: gathered.secSearches,
            costUsd: 0,
          });
        }
      }
    }

    // enrichment hits are citable sources too (news, job boards, award records)
    if (provider) {
      const seen = new Set(sources.map((s) => s.url));
      for (const hit of [...enrichment.hits, ...apolloNews]) {
        if (seen.has(hit.url)) continue;
        seen.add(hit.url);
        sources.push(hit);
      }
    }

    // ---- stage 3: extraction (zod-validated, retry once inside) ----
    const tExtract = Date.now();
    const companyProfile = await getActiveCompanyProfile();
    const { extraction, usage } = await extractSignals({
      companyName: company.name,
      domain,
      domainSource,
      model,
      weights,
      sources,
      facts: enrichment.facts,
      useWebSearchTool,
      now,
      companyProfile,
    });
    mark("extract", tExtract);
    await logUsage({
      runId: run.id,
      companyId: company.id,
      provider: "anthropic",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      searches: usage.webSearches,
      costUsd:
        estimateTokenCostUsd(model, usage.inputTokens, usage.outputTokens) +
        usage.webSearches * WEB_SEARCH_COST_PER_SEARCH_USD,
    });

    // ---- stage 4: deterministic scoring (pure function) ----
    const scores = scoreCompany(
      {
        fit: extraction.fit,
        signals: extraction.signals,
        caveats: extraction.caveats,
      },
      weights,
      now,
    );

    // ---- stage 5: idempotent persistence ----
    const resultId = await upsertCompanyResult({
      runId: run.id,
      companyId: company.id,
      scores,
      meta: {
        industry: extraction.industry,
        hq: extraction.hq,
        sizeLabel: extraction.size_label,
        // Apollo's directory figures backstop the extraction when it came up empty
        employeeEstimate: extraction.employee_estimate ?? apolloOrg?.employees ?? null,
        annualRevenueUsd: extraction.annual_revenue_usd ?? apolloOrg?.revenueUsd ?? null,
        locationCount: extraction.location_count ?? apolloOrg?.locationCount ?? null,
        whyNow: extraction.why_now || null,
        recommendedPlay: normalizePlaySteps(extraction.recommended_play).join("\n") || null,
        caveats: extraction.caveats,
        coverageNotes: extraction.coverage,
        modelUsed: model,
        escalationReasons: job.escalationReasons,
      },
      contacts: extraction.contacts.map((c) => ({
        name: c.name,
        title: c.title,
        roleRationale: c.role_rationale,
        linkedinUrl: c.linkedin_url,
      })),
    });

    // ---- stage 5b: Apollo best contacts, automatic (IT-first, seniority-gated) ----
    // contacts land on the card without anyone pressing "Find best contacts";
    // failure-tolerant — a dead Apollo costs the auto-contacts, not the run
    if (settings?.apolloEnabled && isApolloConfigured() && domain) {
      try {
        const { candidates, appliedPrefs, relaxed, relaxNote } = await searchBestContactsRelaxed({
          domain,
          revenueUsd: extraction.annual_revenue_usd ?? apolloOrg?.revenueUsd ?? null,
          employees: extraction.employee_estimate ?? apolloOrg?.employees ?? null,
          prefs: parseContactPrefs(settings.contactDefaults),
        });
        const added = await addApolloContacts(resultId, candidates);
        await setResultContactFilters(resultId, appliedPrefs);
        if (relaxed) {
          console.log(`worker: ${company.name} — contact filters auto-relaxed (${relaxNote})`);
        }
        if (candidates.length > 0) {
          await logUsage({
            runId: run.id,
            companyId: company.id,
            provider: "apollo",
            searches: 1,
            costUsd: 0,
          });
        }
        if (added > 0) console.log(`worker: ${company.name} — ${added} Apollo contact(s) added`);
      } catch (err) {
        console.log(
          `worker: ${company.name} — apollo contact search skipped: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    await markJobDone(job.id);
    console.log(
      `worker: ${company.name}${passLabel} done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${stageTimes.join(", ")}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`worker: job ${job.id} failed (attempt ${job.attempts + 1}): ${message}`);
    await markJobFailed(job.id, message);
  } finally {
    await completeRunIfDrained(job.runId).catch(() => {});
  }
}
