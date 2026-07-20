import Link from "next/link";
import {
  allProspects,
  prospectsForList,
  type ProspectRow,
} from "@/lib/db/queries/prospects";
import { latestRunForList, listListsWithLatestRun } from "@/lib/db/queries/lists";
import { ListSelector, ProspectsView } from "@/components/prospects/prospects-view";
import { RefreshWhileRunning } from "@/components/prospects/refresh-while-running";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const [{ list: listParamRaw }, lists] = await Promise.all([
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

  const listParam = listParamRaw ?? lists[0].id;
  const isAll = listParam === "all";
  const selectedList = isAll ? null : (lists.find((l) => l.id === listParam) ?? lists[0]);

  let rows: ProspectRow[];
  let activeRunId: string | null = null;
  let runStatus: string | null = null;
  if (isAll) {
    rows = await allProspects();
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

  return (
    <div>
      {activeRunId && <RefreshWhileRunning runId={activeRunId} />}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-disp text-[20px] font-bold text-ink">Prospects</h1>
        <ListSelector
          lists={lists.map((l) => ({ id: l.id, displayName: l.displayName }))}
          value={isAll ? "all" : selectedList!.id}
        />
        {activeRunId && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-spark-soft px-3 py-1 text-[11.5px] font-bold text-spark">
            <span className="h-[6px] w-[6px] animate-spark-pulse rounded-full bg-spark" />
            analyzing — rows stream in as companies finish
          </span>
        )}
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
              : isAll
                ? "No completed runs across your lists yet — run an analysis from the Lists screen."
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
        <ProspectsView rows={rows} listParam={isAll ? "all" : selectedList!.id} showListColumn={isAll} />
      )}
    </div>
  );
}
