"use client";

/**
 * Company enrichment card (0016) — below Press & sources on the company
 * detail page. Shows the Apollo company snapshot captured automatically when
 * the company was analyzed (LinkedIn page, description, firmographics,
 * funding, detected tech, recent news), with a button to (re-)enrich on
 * demand for companies searched earlier.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EnrichmentNewsItem {
  title: string;
  url: string;
  date: string | null;
  event: string | null;
}

export interface EnrichmentData {
  linkedinUrl: string | null;
  description: string | null;
  industry: string | null;
  foundedYear: number | null;
  employees: number | null;
  annualRevenueUsd: number | null;
  locationCount: number | null;
  publiclyTradedSymbol: string | null;
  totalFunding: string | null;
  latestFundingStage: string | null;
  latestFundingDate: string | null;
  keywords: string[];
  news: EnrichmentNewsItem[];
  enrichedAt: string; // ISO
}

function fmtRevenue(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${Math.round(usd).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EnrichmentCard({
  companyId,
  apolloReady,
  data,
}: {
  companyId: string;
  apolloReady: boolean;
  data: EnrichmentData | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enrich() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apollo/enrich-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Enrichment failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrichment failed.");
    } finally {
      setBusy(false);
    }
  }

  const facts: string[] = [];
  if (data?.industry) facts.push(data.industry);
  if (data?.foundedYear) facts.push(`founded ${data.foundedYear}`);
  if (data?.employees) facts.push(`~${data.employees.toLocaleString()} employees`);
  if (data?.annualRevenueUsd) facts.push(`${fmtRevenue(data.annualRevenueUsd)} revenue`);
  if (data?.locationCount) facts.push(`${data.locationCount} locations`);
  if (data?.publiclyTradedSymbol) facts.push(`public (${data.publiclyTradedSymbol})`);
  if (data?.latestFundingStage) {
    facts.push(
      `latest round ${data.latestFundingStage}${data.latestFundingDate ? ` (${data.latestFundingDate})` : ""}${data.totalFunding ? `, ${data.totalFunding} raised` : ""}`,
    );
  }

  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Company enrichment · Apollo</span>
        <span className="h-px flex-1 bg-line-2" />
        {data && <span className="mono normal-case tracking-normal">enriched {fmtDate(data.enrichedAt)}</span>}
      </p>

      {data ? (
        <>
          {data.linkedinUrl && (
            <a
              href={data.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 inline-flex items-center gap-2 rounded-[10px] border border-line bg-[#FBFCFD] px-3 py-1.5 text-[12.5px] font-semibold text-fwa transition-colors hover:border-[#cdd4de]"
            >
              <span className="grid h-[20px] w-[20px] place-items-center rounded-[6px] bg-[#EAF1FB] font-disp text-[11px] font-bold">
                in
              </span>
              Company LinkedIn page
            </a>
          )}

          {data.description && (
            <p className="mb-3 max-w-[70ch] text-[13px] leading-[1.5] text-slate">{data.description}</p>
          )}

          {facts.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {facts.map((f) => (
                <span key={f} className="rounded-[7px] border border-line bg-[#FBFCFD] px-2 py-1 text-[11.5px] text-slate">
                  {f}
                </span>
              ))}
            </div>
          )}

          {data.keywords.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">Tech &amp; keywords</span>
              {data.keywords.slice(0, 10).map((k) => (
                <span key={k} className="rounded-[6px] bg-line-2 px-1.5 py-0.5 text-[10.5px] font-medium text-slate">
                  {k}
                </span>
              ))}
            </div>
          )}

          {data.news.length > 0 && (
            <div className="mb-1">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-muted">
                Recent company news
              </p>
              <div className="flex flex-col gap-1.5">
                {data.news.slice(0, 5).map((n) => (
                  <a
                    key={n.url}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-2 text-[12.5px] leading-[1.4]"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-ink group-hover:text-fwa group-hover:underline">
                      {n.title}
                    </span>
                    {n.date && <span className="mono flex-shrink-0 text-[10.5px] text-muted">{n.date}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mb-3 text-[13px] text-muted">
          {apolloReady
            ? "No Apollo snapshot yet — this company was analyzed before enrichment existed, or Apollo was off at the time. Pull it now:"
            : "Enable Apollo in Settings → Data sources to pull the company's LinkedIn page, firmographics, funding, and recent news."}
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-[10px] bg-spark-soft px-3 py-2 text-[12px] font-medium text-spark">{error}</p>
      )}

      {apolloReady && (
        <button
          type="button"
          onClick={enrich}
          disabled={busy}
          title="Pulls the latest company details and news from Apollo — no export credits used"
          className={cn(
            "flex items-center justify-center gap-2 rounded-[10px] border border-line bg-[#FBFCFD] px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-[#cdd4de] disabled:opacity-50",
            !data && "w-full",
          )}
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : data ? (
            <RefreshCw size={14} aria-hidden />
          ) : (
            <Sparkles size={14} aria-hidden />
          )}
          {busy ? "Enriching…" : data ? "Re-enrich — pull recent info" : "Enrich with Apollo"}
        </button>
      )}

      <p className="mt-3 text-[10.5px] leading-[1.4] text-muted">
        Snapshot captured automatically when a company is first analyzed; use the button to
        refresh it any time. Sourced from Apollo&apos;s directory — no export credits used.
      </p>
    </section>
  );
}
