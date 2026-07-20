import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { getResultDetail } from "@/lib/db/queries/prospects";
import { normalizePlaySteps } from "@/lib/anthropic/extract";
import { CAVEAT_COPY } from "@/lib/scoring/caveats";
import { monogramFor } from "@/components/prospects/monogram";
import { ScoreAnatomyBar, isFreshLabel } from "@/components/prospects/score-anatomy";
import { cn } from "@/lib/utils";

const TIER_LABEL: Record<string, { label: string; band: string; cls: string }> = {
  tier_1: { label: "TIER 1", band: "approach now", cls: "bg-tier1" },
  tier_2: { label: "TIER 2", band: "monitor", cls: "bg-tier2" },
  tier_3: { label: "TIER 3", band: "low / stale", cls: "bg-tier3" },
  defunct: { label: "DEFUNCT", band: "no longer independent", cls: "bg-[#8A94A6]" },
};

const CAT_META: Record<
  string,
  { label: string; bar: string; mini: string; dot: string; descriptor: string; border: string }
> = {
  FWA: { label: "FWA", bar: "bg-fwa", mini: "bg-fwa-soft text-fwa", dot: "bg-fwa", descriptor: "facilities", border: "border-fwa" },
  STARLINK: { label: "Starlink", bar: "bg-starlink", mini: "bg-starlink-soft text-starlink", dot: "bg-starlink", descriptor: "continuity", border: "border-starlink" },
  MOBILITY: { label: "Mobility", bar: "bg-mobility", mini: "bg-mobility-soft text-mobility", dot: "bg-mobility", descriptor: "workforce", border: "border-mobility" },
  BYOD: { label: "BYOD", bar: "bg-byod", mini: "bg-byod-soft text-byod", dot: "bg-byod", descriptor: "distributed work", border: "border-byod" },
};

const CONF_PILL: Record<string, string> = {
  primary: "bg-tier1-soft text-tier1",
  secondary: "bg-[#FBF0DA] text-tier2",
  weak: "bg-line-2 text-slate",
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Prototype-style timeline date: "2026 · MAY". */
function timelineDate(eventDate: string | null, isForward: boolean): string {
  if (!eventDate) return isForward ? "announced · forward" : "undated";
  const [y, m] = eventDate.split("-");
  const label = `${y} · ${MONTHS[Number(m) - 1] ?? m}`;
  return isForward ? `${label} · forward` : label;
}

function sourceInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

function Eyebrow({
  children,
  right,
  dark,
}: {
  children: React.ReactNode;
  right?: string;
  dark?: boolean;
}) {
  return (
    <p
      className={cn(
        "mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em]",
        dark ? "text-[#8fa0b6]" : "text-muted",
      )}
    >
      <span>{children}</span>
      <span className={cn("h-px flex-1", dark ? "bg-white/10" : "bg-line-2")} />
      {right && <span className="mono normal-case tracking-normal">{right}</span>}
    </p>
  );
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const detail = await getResultDetail(resultId);
  if (!detail) notFound();
  const { result, company, list, signals, contacts } = detail;

  const mono = monogramFor(company.name);
  const tier = TIER_LABEL[result.tier] ?? TIER_LABEL.tier_3;
  const fresh = isFreshLabel(result.recencyLabel);
  const caveats = (result.caveats as string[]) ?? [];
  const coverageNotes =
    (result.coverageNotes as Array<{ tone: "good" | "warn"; note: string }>) ?? [];
  const categories = [
    { key: "FWA", score: result.fwaScore },
    { key: "STARLINK", score: result.starlinkScore },
    { key: "MOBILITY", score: result.mobilityScore },
    { key: "BYOD", score: result.byodScore },
  ];
  // hero tags: the top two categories, like the prototype's "FWA · facilities / Mobility · workforce"
  const heroCategories = [...categories]
    .sort((a, b) => b.score - a.score)
    .filter((c) => c.score > result.fitScore)
    .slice(0, 2);
  const strongest = [...signals].sort(
    (a, b) => Number(b.pointsAwarded) - Number(a.pointsAwarded),
  )[0];
  const fitParts = [
    { label: "Industry / workforce", value: result.fitIndustry, max: 10 },
    { label: "Size band", value: result.fitSize, max: 8 },
    { label: "Multi-location", value: result.fitMultilocation, max: 7 },
    { label: "Geography / coverage", value: result.fitGeography, max: 5 },
  ];
  const playSteps = normalizePlaySteps(result.recommendedPlay ?? "");
  // press & sources: one card per unique source article
  const pressCards = signals.filter(
    (s, i) => signals.findIndex((x) => x.sourceUrl === s.sourceUrl) === i,
  );

  return (
    <div>
      <Link
        href={`/prospects?list=${company.listId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        Back to prospects
      </Link>

      {/* header */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div
          className="grid h-[60px] w-[60px] place-items-center rounded-[15px] font-disp text-[22px] font-bold text-white"
          style={{ background: mono.gradient }}
        >
          {mono.letter}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="mb-1.5 font-disp text-[26px] font-bold tracking-[-.01em] text-ink">
            {company.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate">
            {result.hq && <span>{result.hq}</span>}
            {result.industry && (
              <>
                <span className="h-[3px] w-[3px] rounded-full bg-[#c3cbd6]" />
                <span>{result.industry}</span>
              </>
            )}
            {result.sizeLabel && (
              <>
                <span className="h-[3px] w-[3px] rounded-full bg-[#c3cbd6]" />
                <span>{result.sizeLabel}</span>
              </>
            )}
            <span className="h-[3px] w-[3px] rounded-full bg-[#c3cbd6]" />
            {company.domain ? (
              <span className="inline-flex items-center gap-1.5">
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fwa hover:underline"
                >
                  {company.domain}
                </a>
                {company.domainSource === "lookup" && (
                  <span
                    title="This domain was resolved by research, not provided in the uploaded list"
                    className="rounded-md bg-line-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted"
                  >
                    domain: looked up
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted">no domain found</span>
            )}
            <span
              className={cn(
                "rounded-[7px] px-2.5 py-1 font-disp text-[11px] font-bold tracking-[.06em] text-white",
                tier.cls,
              )}
            >
              {tier.label}
            </span>
            {result.modelUsed === "claude-opus-4-8" && (
              <span
                title={`Re-analyzed with the high-accuracy model${((result.escalationReasons as string[]) ?? []).length > 0 ? ` — triggers: ${((result.escalationReasons as string[]) ?? []).join(", ").replaceAll("_", " ")}` : ""}`}
                className="rounded-[7px] bg-mobility-soft px-2 py-1 font-disp text-[10.5px] font-bold tracking-[.04em] text-mobility"
              >
                HIGH-ACCURACY
              </span>
            )}
          </div>
          <div className="mt-1 text-[11.5px] text-muted">from {list.displayName}</div>
        </div>
        <div className="text-right">
          <div className="mono text-[48px] font-bold leading-none tracking-[-.02em] text-ink">
            {result.totalScore}
            <span className="text-[16px] text-muted">/100</span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[.08em] text-muted">
            {tier.band}
            {fresh ? " · fresh trigger" : ""}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          {/* why now hero */}
          <section className="rounded-card border-none bg-gradient-to-br from-[#132132] to-ink p-5 shadow-card">
            <Eyebrow dark>Why now</Eyebrow>
            <p className="mb-2 font-disp text-[20px] font-semibold leading-[1.3] text-white">
              {result.whyNow || "No current trigger identified."}
            </p>
            {strongest && (
              <p className="max-w-[60ch] text-[13.5px] leading-[1.5] text-[#b8c4d4]">
                Strongest evidence: {strongest.title.toLowerCase().startsWith("the") ? "" : "the "}
                {strongest.title.charAt(0).toLowerCase() + strongest.title.slice(1)}
                {strongest.sourceName ? ` (${strongest.sourceName})` : ""}.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {heroCategories.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1.5 rounded-[20px] border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-[#dbe4ee]"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", CAT_META[c.key].dot)} />
                  {CAT_META[c.key].label} · {CAT_META[c.key].descriptor}
                </span>
              ))}
              {strongest && (
                <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-[#dbe4ee]">
                  <span className="h-1.5 w-1.5 rounded-full bg-spark" />
                  Recency ×{Number(strongest.recencyMultiplier).toFixed(1)}
                </span>
              )}
            </div>
          </section>

          {/* score anatomy */}
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow right="fit + trigger">Score anatomy</Eyebrow>
            <div className="mb-4 flex flex-col gap-5 sm:flex-row">
              <div className="flex-1">
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="font-disp text-[13px] font-semibold text-ink">Fit</span>
                  <span className="mono ml-auto text-[15px] font-bold text-ink">
                    {result.fitScore}
                    <span className="text-[11px] font-normal text-muted">/30</span>
                  </span>
                </div>
                {fitParts.map((p) => (
                  <div key={p.label} className="mb-3 flex items-center gap-3">
                    <span className="w-[140px] flex-shrink-0 text-[12.5px] text-slate">{p.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-line-2">
                      <div
                        className="h-full rounded-[5px] bg-steel"
                        style={{ width: `${(p.value / p.max) * 100}%` }}
                      />
                    </div>
                    <span className="mono w-[40px] text-right text-[12px] font-bold text-ink">
                      {p.value}/{p.max}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="font-disp text-[13px] font-semibold text-ink">Trigger</span>
                  <span className="mono ml-auto text-[15px] font-bold text-ink">
                    {result.triggerScore}
                    <span className="text-[11px] font-normal text-muted">/70</span>
                  </span>
                </div>
                {strongest ? (
                  <div className="mono rounded-[10px] border border-line-2 bg-[#FBFCFD] px-3.5 py-3 text-[12px] text-slate">
                    {strongest.eventType.replaceAll("_", " ")}{" "}
                    <b className="text-ink">{strongest.basePoints}</b>
                    <span className="mx-1 font-bold text-spark">×</span>recency{" "}
                    <b className="text-ink">{Number(strongest.recencyMultiplier).toFixed(1)}</b>
                    <span className="mx-1 font-bold text-spark">×</span>confidence{" "}
                    <b className="text-ink">{Number(strongest.confidence).toFixed(2)}</b>
                    <span className="text-muted"> ≈ </span>
                    <b className="text-tier1">{Math.round(Number(strongest.pointsAwarded))}</b>
                    {signals.length > 1 && (
                      <span className="text-muted">
                        {" "}
                        (+ {signals.length - 1} more signal{signals.length > 2 ? "s" : ""},
                        capped at 70)
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-muted">
                    No source-backed signals — trigger score is 0 by rule.
                  </p>
                )}
              </div>
            </div>
            <ScoreAnatomyBar
              fit={result.fitScore}
              trigger={result.triggerScore}
              tier={result.tier}
              fresh={fresh}
              height={11}
              showLabels={false}
            />
            <div className="mono mt-2 flex gap-4 text-[11px] text-muted">
              <span><b className="text-steel">▮</b> fit {result.fitScore}</span>
              <span><b className="text-tier1">▮</b> trigger {result.triggerScore}</span>
              {fresh && <span className="ml-auto"><b className="text-spark">●</b> live trigger</span>}
            </div>
          </section>

          {/* category breakdown */}
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow>Category breakdown</Eyebrow>
            {categories.map((c) => (
              <div key={c.key} className="mb-3 flex items-center gap-3 last:mb-0">
                <span
                  className={cn(
                    "w-[140px] flex-shrink-0 text-[12.5px]",
                    result.primaryCategory === c.key ? "font-bold text-ink" : "text-slate",
                  )}
                >
                  {CAT_META[c.key].label}
                  {result.primaryCategory === c.key && " · primary"}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-line-2">
                  <div
                    className={cn("h-full rounded-[5px]", CAT_META[c.key].bar)}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                <span className="mono w-[40px] text-right text-[12px] font-bold text-ink">
                  {c.score}
                </span>
              </div>
            ))}
          </section>

          {/* signal timeline — concise: date, event, source, confidence, categories */}
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow right={`${signals.length} event${signals.length === 1 ? "" : "s"}`}>
              Signal timeline
            </Eyebrow>
            {signals.length === 0 ? (
              <p className="text-[13px] text-muted">
                No qualifying signals were found in public sources.
              </p>
            ) : (
              <div className="relative pl-6 before:absolute before:bottom-2 before:left-[6px] before:top-1.5 before:w-[2px] before:bg-line">
                {signals.map((s) => (
                  <div key={s.id} className="relative pb-5 last:pb-0">
                    <span
                      className={cn(
                        "absolute -left-6 top-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] bg-white",
                        s.categories.length > 1
                          ? "border-spark"
                          : (CAT_META[s.categories[0]]?.border ?? "border-tier3"),
                      )}
                    />
                    <div className="mono mb-0.5 text-[11px] text-muted">
                      {timelineDate(s.eventDate, s.isForward)}
                    </div>
                    <div className="text-[13.5px] font-medium leading-[1.4] text-ink">{s.title}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-line bg-[#FBFCFD] px-2 py-0.5 text-[10.5px] text-slate hover:border-[#cdd4de] hover:text-fwa"
                      >
                        {s.sourceName ?? new URL(s.sourceUrl).hostname}
                      </a>
                      {s.sourceClass && (
                        <span className={cn("rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold", CONF_PILL[s.sourceClass])}>
                          {s.sourceClass} · ×{Number(s.confidence).toFixed(2)}
                        </span>
                      )}
                      <span className="mono text-[10.5px] text-muted">
                        +{Number(s.pointsAwarded).toFixed(1)} pts
                      </span>
                      {s.categories.map((c) => (
                        <span key={c} className={cn("rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold", CAT_META[c]?.mini)}>
                          {c === "STARLINK" ? "STAR" : c === "MOBILITY" ? "MOB" : c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* press & sources — paraphrased summaries with links, below the timeline */}
          {pressCards.length > 0 && (
            <section className="rounded-card border border-line bg-card p-5 shadow-card">
              <Eyebrow>Press &amp; sources</Eyebrow>
              <div className="flex flex-col gap-3">
                {pressCards.map((s) => {
                  const sourceName = s.sourceName ?? new URL(s.sourceUrl).hostname;
                  const thumb = monogramFor(sourceName);
                  return (
                    <a
                      key={s.id}
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3.5 rounded-[11px] border border-line-2 p-3.5 transition-colors hover:border-[#cdd4de] hover:bg-[#FAFBFC]"
                    >
                      <span
                        className="grid h-[46px] w-[46px] flex-shrink-0 place-items-center rounded-[10px] font-disp text-[15px] font-bold text-white"
                        style={{ background: thumb.gradient }}
                      >
                        {sourceInitials(sourceName)}
                      </span>
                      <span className="min-w-0">
                        <span className="mb-1 block font-disp text-[14px] font-semibold leading-[1.35] text-ink">
                          {s.title}
                        </span>
                        <span className="mb-1.5 block text-[12px] leading-[1.45] text-slate">
                          {s.summary}
                        </span>
                        <span className="mono flex gap-2.5 text-[11px] text-muted">
                          <span>{sourceName}</span>
                          <span>{timelineDate(s.eventDate, s.isForward)}</span>
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5">
          {/* recommended play — concise numbered steps with bold lead-ins */}
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow>Recommended play</Eyebrow>
            {playSteps.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {playSteps.map((step, i) => {
                  const dot = step.indexOf(". ");
                  const lead = dot === -1 ? step : step.slice(0, dot + 1);
                  const rest = dot === -1 ? "" : step.slice(dot + 2);
                  return (
                    <li key={i} className="flex gap-2.5 text-[13px] leading-[1.45] text-slate">
                      <span className="mono grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-[7px] bg-ink text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span>
                        <b className="font-semibold text-ink">{lead}</b>
                        {rest && ` ${rest}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No play generated for this company.</p>
            )}
          </section>

          {/* contacts */}
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow>Top contacts</Eyebrow>
            {contacts.length === 0 ? (
              <p className="text-[13px] text-muted">
                No contacts surfaced from public sources for this company.
              </p>
            ) : (
              contacts.map((c) => {
                const avatar = monogramFor(c.name);
                return (
                  <div key={c.id} className="flex gap-3 border-b border-line-2 py-3 first:pt-0 last:border-none last:pb-0">
                    <span
                      className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full font-disp text-[14px] font-semibold text-white"
                      style={{ background: avatar.gradient }}
                    >
                      {sourceInitials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-disp text-[13.5px] font-semibold text-ink">
                        {c.name}
                        {!c.verified && (
                          <span className="rounded-md bg-[#FBF0DA] px-1.5 py-0.5 text-[10px] font-semibold text-tier2">
                            unverified
                          </span>
                        )}
                      </div>
                      {c.title && <div className="mt-0.5 text-[12px] text-slate">{c.title}</div>}
                      {c.roleRationale && (
                        <div className="mt-1 text-[11.5px] leading-[1.4] text-muted">{c.roleRationale}</div>
                      )}
                      <button
                        type="button"
                        disabled
                        title="Contact enrichment via Apollo.io arrives in Phase 2"
                        className="mt-1.5 cursor-not-allowed rounded-lg border border-line bg-line-2 px-2 py-0.5 text-[10.5px] font-medium text-muted"
                      >
                        Reveal email — Apollo · Phase 2
                      </button>
                    </div>
                    {c.linkedinUrl && (
                      <a
                        href={c.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-[7px] bg-[#EAF1FB] font-disp text-[12px] font-bold text-fwa"
                      >
                        in
                      </a>
                    )}
                  </div>
                );
              })
            )}
            <p className="mt-3 text-[10.5px] leading-[1.4] text-muted">
              Contacts found via public search — verify names and roles before outreach.
            </p>
          </section>

          {/* coverage & caveats — good + warn rows */}
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow>Coverage &amp; caveats</Eyebrow>
            {coverageNotes.length === 0 && caveats.length === 0 && (
              <div className="flex gap-2.5 text-[12.5px] leading-[1.4] text-slate">
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-[7px] bg-tier1-soft text-tier1">
                  <Check size={13} aria-hidden />
                </span>
                <span>
                  <b className="font-semibold text-ink">Clean target.</b> No procurement,
                  identity, or viability caveats were flagged for this company.
                </span>
              </div>
            )}
            {coverageNotes.map((note, i) => (
              <div key={i} className="mb-3 flex gap-2.5 text-[12.5px] leading-[1.4] text-slate last:mb-0">
                <span
                  className={cn(
                    "grid h-6 w-6 flex-shrink-0 place-items-center rounded-[7px]",
                    note.tone === "good" ? "bg-tier1-soft text-tier1" : "bg-[#FBF0DA] text-tier2",
                  )}
                >
                  {note.tone === "good" ? (
                    <Check size={13} aria-hidden />
                  ) : (
                    <AlertTriangle size={13} aria-hidden />
                  )}
                </span>
                <span>{note.note}</span>
              </div>
            ))}
            {caveats.map((key) => {
              const copy = CAVEAT_COPY[key];
              return (
                <div key={key} className="mb-3 flex gap-2.5 text-[12.5px] leading-[1.4] text-slate last:mb-0">
                  <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-[7px] bg-[#FBF0DA] text-tier2">
                    <AlertTriangle size={13} aria-hidden />
                  </span>
                  <span>
                    <b className="font-semibold text-ink">{copy?.label ?? key}.</b>{" "}
                    {copy?.detail}
                    {copy?.capsTier && (
                      <span className="text-tier2"> Caps this company at Tier 2.</span>
                    )}
                  </span>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
