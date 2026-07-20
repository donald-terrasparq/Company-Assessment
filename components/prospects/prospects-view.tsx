"use client";

/**
 * Prospects table (ticket 4.2): filter chips, tier distribution, sortable
 * rows with the score-anatomy bar. Filtering/sorting is client-side (a list
 * caps at 100 rows); Export CSV passes the active filters to the server so
 * the file honors them.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyFilters, type ProspectFilters } from "@/lib/export/csv";
import type { ProspectRow } from "@/lib/db/queries/prospects";
import { CAVEAT_COPY } from "@/lib/scoring/caveats";
import { monogramFor } from "./monogram";
import { ScoreAnatomyBar, isFreshLabel } from "./score-anatomy";

const TIER_META: Record<string, { label: string; dot: string }> = {
  tier_1: { label: "Tier 1", dot: "bg-tier1" },
  tier_2: { label: "Tier 2", dot: "bg-tier2" },
  tier_3: { label: "Tier 3", dot: "bg-tier3" },
};
const CATEGORY_META: Record<string, { label: string; cls: string; dot: string }> = {
  FWA: { label: "FWA", cls: "bg-fwa-soft text-fwa", dot: "bg-fwa" },
  STARLINK: { label: "STAR", cls: "bg-starlink-soft text-starlink", dot: "bg-starlink" },
  MOBILITY: { label: "MOB", cls: "bg-mobility-soft text-mobility", dot: "bg-mobility" },
  BYOD: { label: "BYOD", cls: "bg-byod-soft text-byod", dot: "bg-byod" },
};

type SortKey = "score" | "company" | "industry";

export function ProspectsView({
  rows,
  listParam,
  showListColumn,
}: {
  rows: ProspectRow[];
  listParam: string;
  showListColumn: boolean;
}) {
  const router = useRouter();
  const [tiers, setTiers] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [freshOnly, setFreshOnly] = useState(false);
  const [hideCaveats, setHideCaveats] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");

  const filters: ProspectFilters = { tiers, categories: cats, freshOnly, hideCaveats };
  const filtered = useMemo(() => {
    const f = applyFilters(rows, filters);
    const sorted = [...f];
    if (sort === "company") sorted.sort((a, b) => a.companyName.localeCompare(b.companyName));
    else if (sort === "industry")
      sorted.sort((a, b) => (a.industry ?? "").localeCompare(b.industry ?? ""));
    else sorted.sort((a, b) => b.totalScore - a.totalScore);
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tiers, cats, freshOnly, hideCaveats, sort]);

  const dist = useMemo(() => {
    const counts = { tier_1: 0, tier_2: 0, tier_3: 0, defunct: 0 };
    for (const r of rows) counts[r.tier as keyof typeof counts] = (counts[r.tier as keyof typeof counts] ?? 0) + 1;
    return counts;
  }, [rows]);
  const total = rows.length || 1;

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const exportUrl = useMemo(() => {
    const p = new URLSearchParams({ list: listParam });
    if (tiers.length) p.set("tiers", tiers.join(","));
    if (cats.length) p.set("categories", cats.join(","));
    if (freshOnly) p.set("fresh", "1");
    if (hideCaveats) p.set("hide_caveats", "1");
    return `/api/export?${p.toString()}`;
  }, [listParam, tiers, cats, freshOnly, hideCaveats]);

  return (
    <div>
      {/* tier distribution */}
      <div className="mb-5 rounded-card border border-line bg-card px-5 py-4 shadow-card">
        <div className="mb-2.5 flex h-2 overflow-hidden rounded-[5px] bg-line-2">
          {(["tier_1", "tier_2", "tier_3", "defunct"] as const).map((t) => (
            <span
              key={t}
              className={cn(
                t === "tier_1" && "bg-tier1",
                t === "tier_2" && "bg-tier2",
                t === "tier_3" && "bg-tier3",
                t === "defunct" && "bg-[#C6CCD6]",
              )}
              style={{ width: `${(dist[t] / total) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-5 text-[12px] text-slate">
          <span><span className="mr-1.5 inline-block h-[9px] w-[9px] rounded-[3px] bg-tier1" />Tier 1 · approach now <b className="mono text-ink">{dist.tier_1}</b></span>
          <span><span className="mr-1.5 inline-block h-[9px] w-[9px] rounded-[3px] bg-tier2" />Tier 2 · monitor <b className="mono text-ink">{dist.tier_2}</b></span>
          <span><span className="mr-1.5 inline-block h-[9px] w-[9px] rounded-[3px] bg-tier3" />Tier 3 · low / stale <b className="mono text-ink">{dist.tier_3}</b></span>
          <span><span className="mr-1.5 inline-block h-[9px] w-[9px] rounded-[3px] bg-[#C6CCD6]" />Defunct <b className="mono text-ink">{dist.defunct}</b></span>
        </div>
      </div>

      {/* filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {Object.entries(TIER_META).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(tiers, setTiers, key)}
            className={cn(
              "flex items-center gap-1.5 rounded-[20px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              tiers.includes(key)
                ? "border-ink bg-ink text-white"
                : "border-line bg-card text-slate hover:border-[#cdd4de]",
            )}
          >
            {meta.label}
            <span className={cn("h-[7px] w-[7px] rounded-full", meta.dot)} />
          </button>
        ))}
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(cats, setCats, key)}
            className={cn(
              "flex items-center gap-1.5 rounded-[20px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              cats.includes(key)
                ? "border-ink bg-ink text-white"
                : "border-line bg-card text-slate hover:border-[#cdd4de]",
            )}
          >
            {key === "STARLINK" ? "Starlink" : key === "MOBILITY" ? "Mobility" : meta.label}
            <span className={cn("h-[7px] w-[7px] rounded-full", meta.dot)} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFreshOnly(!freshOnly)}
          className={cn(
            "rounded-[20px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            freshOnly ? "border-ink bg-ink text-white" : "border-line bg-card text-slate hover:border-[#cdd4de]",
          )}
        >
          Fresh &lt;30d
        </button>
        <button
          type="button"
          onClick={() => setHideCaveats(!hideCaveats)}
          className={cn(
            "rounded-[20px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            hideCaveats ? "border-ink bg-ink text-white" : "border-line bg-card text-slate hover:border-[#cdd4de]",
          )}
        >
          Hide caveats
        </button>
        <span className="mono ml-auto text-[12px] text-muted">
          {filtered.length} of {rows.length} shown · sorted by {sort}
        </span>
        <a
          href={exportUrl}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-[#cdd4de]"
        >
          <Download size={13} aria-hidden />
          Export CSV
        </a>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left">
          <caption className="sr-only">Ranked prospect results</caption>
          <thead>
            <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted">
              <th className="w-10 px-4 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">
                <button type="button" onClick={() => setSort("company")} className="uppercase tracking-[.09em] hover:text-ink">
                  Company{sort === "company" && " ↓"}
                </button>
              </th>
              <th className="px-3 py-3 font-semibold">
                <button type="button" onClick={() => setSort("industry")} className="uppercase tracking-[.09em] hover:text-ink">
                  Industry{sort === "industry" && " ↓"}
                </button>
              </th>
              <th className="px-3 py-3 font-semibold">
                <button type="button" onClick={() => setSort("score")} className="uppercase tracking-[.09em] hover:text-ink">
                  Score · Fit / Trigger{sort === "score" && " ↓"}
                </button>
              </th>
              <th className="px-3 py-3 font-semibold">Why now</th>
              {showListColumn && <th className="px-3 py-3 font-semibold">List</th>}
              <th className="px-3 py-3 font-semibold">Service</th>
              <th className="w-8 px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const mono = monogramFor(r.companyName);
              const fresh = isFreshLabel(r.recencyLabel);
              return (
                <tr
                  key={r.resultId}
                  onClick={() => router.push(`/company/${r.resultId}`)}
                  className={cn(
                    "relative cursor-pointer border-b border-line-2 transition-colors last:border-none hover:bg-[#FAFBFC]",
                  )}
                >
                  <td className="mono px-4 py-4 text-[12px] text-muted">{i + 1}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[11px] font-disp text-[15px] font-bold text-white"
                        style={{ background: mono.gradient }}
                      >
                        {mono.letter}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-disp text-[14px] font-semibold text-ink">
                          {r.companyName}
                        </div>
                        <div className="truncate text-[11.5px] text-muted">
                          {[r.hq, r.sizeLabel].filter(Boolean).join(" · ") || r.domain || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    {r.industry ? (
                      <span className="rounded-[7px] border border-line bg-[#FBFCFD] px-2 py-1 text-[12px] text-slate">
                        {r.industry}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="mono w-[30px] text-right text-[17px] font-bold text-ink">
                        {r.totalScore}
                      </span>
                      <ScoreAnatomyBar
                        fit={r.fitScore}
                        trigger={r.triggerScore}
                        tier={r.tier}
                        fresh={fresh}
                      />
                    </div>
                  </td>
                  <td className="max-w-[260px] px-3 py-4">
                    <div className="truncate text-[12.5px] font-medium text-ink" title={r.whyNow ?? undefined}>
                      {r.whyNow || <span className="text-muted">no current trigger</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {fresh && (
                        <span className="inline-flex items-center gap-1 rounded-[20px] bg-tier1-soft px-2 py-px text-[10px] font-bold text-tier1">
                          <span className="h-[5px] w-[5px] rounded-full bg-tier1" />
                          FRESH
                        </span>
                      )}
                      {r.recencyLabel && (
                        <span className="mono text-[10.5px] text-muted">{r.recencyLabel}</span>
                      )}
                    </div>
                    {r.caveats.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-tier2">
                        <AlertTriangle size={11} aria-hidden />
                        {CAVEAT_COPY[r.caveats[0]]?.label ?? r.caveats[0]}
                        {r.caveats.length > 1 ? ` +${r.caveats.length - 1}` : ""}
                      </div>
                    )}
                  </td>
                  {showListColumn && (
                    <td className="max-w-[140px] truncate px-3 py-4 text-[11.5px] text-muted">
                      {r.listName}
                    </td>
                  )}
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-1">
                      {r.primaryCategory && CATEGORY_META[r.primaryCategory] && (
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tracking-[.03em]",
                            CATEGORY_META[r.primaryCategory].cls,
                          )}
                        >
                          {CATEGORY_META[r.primaryCategory].label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-4 text-muted">
                    <ChevronRight size={16} aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            No companies match the active filters.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * List selector (ticket 4.3 + VIEW SELECTED): single list, VIEW ALL, or a
 * checkbox multi-select that combines chosen lists into one dynamically
 * ranked board.
 */
export function ListSelector({
  lists,
  value,
  selectedIds,
}: {
  lists: Array<{ id: string; displayName: string }>;
  value: string; // list id | 'all' | 'selected'
  selectedIds: string[];
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(selectedIds));

  function onSelectChange(v: string) {
    if (v === "selected") {
      setPickerOpen(true);
      return;
    }
    setPickerOpen(false);
    router.push(`/prospects?list=${v}`);
  }

  function applyPicked() {
    if (picked.size === 0) return;
    setPickerOpen(false);
    router.push(`/prospects?lists=${[...picked].join(",")}`);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onSelectChange(e.target.value)}
            className="appearance-none rounded-[10px] border border-line bg-card py-2 pl-3 pr-8 font-disp text-[13.5px] font-semibold text-ink outline-none focus:border-steel"
            aria-label="Select list"
          >
            <option value="all">VIEW ALL — every list</option>
            <option value="selected">
              VIEW SELECTED{selectedIds.length > 0 ? ` — ${selectedIds.length} lists` : "…"}
            </option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.displayName}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        </div>
        {value === "selected" && !pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-[10px] border border-line bg-card px-3 py-2 text-[12.5px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink"
          >
            Edit selection
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[320px] rounded-card border border-line bg-card p-4 shadow-lg">
          <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
            Combine lists — ranked by score
          </p>
          <div className="mb-3 flex max-h-[240px] flex-col gap-1.5 overflow-auto">
            {lists.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-ink hover:bg-[#FAFBFC]">
                <input
                  type="checkbox"
                  checked={picked.has(l.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(l.id);
                    else next.delete(l.id);
                    setPicked(next);
                  }}
                />
                <span className="truncate">{l.displayName}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="rounded-[10px] border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-slate hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={applyPicked}
              className="rounded-[10px] border border-ink bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#1b2d43] disabled:opacity-50"
            >
              View {picked.size} list{picked.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
