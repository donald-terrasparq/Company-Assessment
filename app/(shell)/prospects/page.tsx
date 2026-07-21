import Link from "next/link";
import {
  allProspects,
  prospectsForList,
  prospectsForLists,
  prospectsForManualList,
  type ProspectRow,
} from "@/lib/db/queries/prospects";
import { MANUAL_LIST_NAME } from "@/lib/db/queries/manual";
import { latestRunForList, listListsWithLatestRun } from "@/lib/db/queries/lists";
import { ListSelector, ProspectsView } from "@/components/prospects/prospects-view";
import { RefreshWhileRunning } from "@/components/prospects/refresh-while-running";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; lists?: string; q?: string; session?: string }>;
}) {
  const [{ list: listParamRaw, lists: listsParamRaw, q, session }, lists] = await Promise.all([
    searchParams,
    listListsWithLatestRun(),
  ]);

  if (lists.length === 0) {
    return (
      <section className="grid place-items-center rounded-card border border-line bg-card px-6 py-20 text-center shadow-card">
        <h1 className="mb-1 font-disp text-[18px] font-semibold text-ink">
          No lists yet — upload one to get started
        </h1>
        <p className="mb-5 max-w-[42ch] text-[13px] text-slate">
          Drop a spreadsheet of companies (CompanyName required, WebSite optional) and run
          the analysis to see ranked prospects here.
        </p>
        <Link
          href="/lists?upload=1"
          className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
        >
          Upload a list
        </Link>
      </section>
    );
  }

  const knownIds = new Set(lists.map((l) => l.id));
  // three modes: VIEW SELECTED (?lists=a,b) > VIEW ALL (?list=all) > single list
  const selectedIds = (listsParamRaw ?? "")
    .split(",")
    .filter((id) => knownIds.has(id));
  const isSelected = selectedIds.length > 0;
  const listParam = listParamRaw ?? lists[0].id;
  const isAll = !isSelected && listParam === "all";
  const selectedList =
    isAll || isSelected ? null : (lists.find((l) => l.id === listParam) ?? lists[0]);

  // Manual Entry accumulates single-company runs — show every entry's latest
  // result (with entry date), not just the newest run
  const isManual = !isAll && !isSelected && selectedList!.name === MANUAL_LIST_NAME;

  let rows: ProspectRow[];
  let activeRunId: string | null = null;
  let runStatus: string | null = null;
  if (isSelected) {
    rows = await prospectsForLists(selectedIds);
  } else if (isAll) {
    rows = await allProspects();
  } else if (isManual) {
    rows = await prospectsForManualList(selectedList!.id);
    const latest = await latestRunForList(selectedList!.id);
    if (latest) {
      runStatus = latest.status;
      if (latest.status === "queued" || latest.status === "running") {
        activeRunId = latest.id;
      }
    }
  } else {
    rows = await prospectsForList(selectedList!.id);
    const latest = await latestRunForList(selectedList!.id);
    if (latest) {
      runStatus = latest.status;
      if (latest.status === "queued" || latest.status === "running") {
        activeRunId = latest.id;
      }
    }
  }

  const selectorValue = isSelected ? "selected" : isAll ? "all" : selectedList!.id;
  const exportParam = isSelected ? `sel:${selectedIds.join(",")}` : isAll ? "all" : selectedList!.id;
  const showListColumn = isAll || isSelected;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-disp text-[20px] font-bold text-ink">Prospects</h1>
        <ListSelector
          lists={lists.map((l) => ({ id: l.id, displayName: l.displayName }))}
          value={selectorValue}
          selectedIds={selectedIds}
        />
        {isSelected && (
          <span className="mono text-[11.5px] text-muted">
            {selectedIds.length} lists combined · ranked by score · deduped by domain
          </span>
        )}
        {activeRunId && <RefreshWhileRunning runId={activeRunId} />}
        {runStatus === "halted_budget" && (
          <span className="rounded-full bg-[#FBF0DA] px-3 py-1 text-[11.5px] font-bold text-tier2">
            run halted at budget cap
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <section className="grid place-items-center rounded-card border border-line bg-card px-6 py-16 text-center shadow-card">
          <h2 className="mb-1 font-disp text-[16px] font-semibold text-ink">
            {activeRunId ? "Analysis starting…" : "No results yet"}
          </h2>
          <p className="mb-4 max-w-[46ch] text-[13px] text-slate">
            {activeRunId
              ? "The first companies will appear here within a minute or two."
              : isAll || isSelected
                ? "No completed runs across the chosen lists yet — run an analysis from the Lists screen."
                : "This list hasn't been analyzed yet. Start a run from the Lists screen."}
          </p>
          {!activeRunId && (
            <Link
              href="/lists"
              className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
            >
              Go to Lists
            </Link>
          )}
        </section>
      ) : (
        <ProspectsView
          rows={rows}
          listParam={exportParam}
          showListColumn={showListColumn}
          initialQuery={q ?? ""}
          showEntryDate={isManual}
          sessionOnly={isManual && session === "1"}
        />
      )}
    </div>
  );
}
