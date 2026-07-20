import { auth } from "@/auth";
import { listListsWithLatestRun } from "@/lib/db/queries/lists";
import { getSettings } from "@/lib/db/queries/settings";
import { UploadModal } from "@/components/lists/upload-modal";
import { RunControls } from "@/components/lists/run-controls";
import { DeleteListButton } from "@/components/lists/delete-list-button";

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ upload?: string }>;
}) {
  const [{ upload }, lists, session] = await Promise.all([
    searchParams,
    listListsWithLatestRun(),
    auth(),
  ]);
  // the cost estimator is admin-only (Phase 6)
  let estimator: { model: string; searchProvider: string; escalationPct: number } | null =
    null;
  if (session?.user.role === "admin") {
    const settings = await getSettings();
    if (settings) {
      estimator = {
        model: settings.model,
        searchProvider: settings.searchProvider,
        escalationPct: settings.escalationPct,
      };
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <h1 className="font-disp text-[20px] font-bold text-ink">Lists</h1>
        <span className="mono text-[11.5px] text-muted">
          {lists.length} list{lists.length === 1 ? "" : "s"} · max 100 companies each
        </span>
        <span className="flex-1" />
        <UploadModal initialOpen={upload === "1"} estimator={estimator} />
      </div>

      {lists.length === 0 ? (
        <section className="grid place-items-center rounded-card border border-line bg-card px-6 py-16 text-center shadow-card">
          <h2 className="mb-1 font-disp text-[16px] font-semibold text-ink">No lists yet</h2>
          <p className="mb-4 max-w-[40ch] text-[13px] text-slate">
            Upload a .csv or .xlsx with your companies to get started — a CompanyName column
            is required, a WebSite column helps.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">All uploaded company lists</caption>
            <thead>
              <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Uploaded</th>
                <th className="px-5 py-3 font-semibold">Companies</th>
                <th className="px-5 py-3 font-semibold">Last run</th>
                <th className="px-5 py-3 font-semibold">Cost</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id} className="border-b border-line-2 last:border-none">
                  <td className="px-5 py-3.5">
                    <div className="font-disp font-semibold text-ink">{l.displayName}</div>
                    <div className="text-[11.5px] text-muted">{l.sourceFilename}</div>
                  </td>
                  <td className="mono px-5 py-3.5 text-[11.5px] text-muted">
                    {l.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="mono px-5 py-3.5 text-[12px] text-slate">
                    <b className="text-ink">{l.companyCount}</b> / 100
                  </td>
                  <td className="px-5 py-3.5">
                    <RunControls
                      listId={l.id}
                      latestRunId={l.latestRunId}
                      latestRunStatus={l.latestRunStatus}
                    />
                  </td>
                  <td className="mono px-5 py-3.5 text-[12px] text-slate">
                    {l.latestRunCostUsd ? `$${Number(l.latestRunCostUsd).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <DeleteListButton listId={l.id} name={l.displayName} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
