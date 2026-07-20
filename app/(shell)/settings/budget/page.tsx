import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/db/queries/settings";
import { monthToDateCostUsd, usageByProviderThisMonth } from "@/lib/db/queries/usage";
import { updateBudgetAction } from "../admin-actions";
import { cn } from "@/lib/utils";

export default async function BudgetSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();
  const [settings, spent, byProvider] = await Promise.all([
    getSettings(),
    monthToDateCostUsd(),
    usageByProviderThisMonth(),
  ]);
  const cap = Number(settings?.monthlyBudgetUsd ?? 100);
  const pct = Math.min(100, Math.round((spent / cap) * 100));
  const alert80 = pct >= 80 && pct < 100;
  const atCap = pct >= 100;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {/* spend dashboard */}
      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Spend this month</span>
          <span className="h-px flex-1 bg-line-2" />
          <span className="mono normal-case tracking-normal">
            ${spent.toFixed(2)} of ${cap.toFixed(2)}
          </span>
        </p>
        <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-line-2">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              atCap ? "bg-spark" : alert80 ? "bg-tier2" : "bg-tier1",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {atCap && (
          <p className="mb-3 rounded-[10px] bg-spark-soft px-3 py-2 text-[12.5px] font-semibold text-spark">
            Budget cap reached — new runs are blocked and in-flight runs halt (halted_budget).
          </p>
        )}
        {alert80 && (
          <p className="mb-3 rounded-[10px] bg-[#FBF0DA] px-3 py-2 text-[12.5px] font-semibold text-tier2">
            Over 80% of the monthly budget — plan remaining runs accordingly.
          </p>
        )}
        {byProvider.length === 0 ? (
          <p className="text-[12.5px] text-muted">No API usage recorded this month yet.</p>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted">
                <th className="py-2 font-semibold">Provider</th>
                <th className="py-2 text-right font-semibold">Searches</th>
                <th className="py-2 text-right font-semibold">Tokens in / out</th>
                <th className="py-2 text-right font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.map((p) => (
                <tr key={p.provider} className="border-b border-line-2 last:border-none">
                  <td className="py-2 font-medium text-ink">{p.provider}</td>
                  <td className="mono py-2 text-right text-slate">{p.searches.toLocaleString()}</td>
                  <td className="mono py-2 text-right text-slate">
                    {p.inputTokens.toLocaleString()} / {p.outputTokens.toLocaleString()}
                  </td>
                  <td className="mono py-2 text-right font-bold text-ink">${p.costUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* cap */}
      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Monthly budget cap</span>
          <span className="h-px flex-1 bg-line-2" />
        </p>
        <form action={updateBudgetAction} className="flex items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-slate">Cap (USD / month)</span>
            <input
              name="budget"
              type="number"
              min={1}
              step={1}
              defaultValue={cap}
              className="mono w-[140px] rounded-[10px] border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-steel"
            />
          </label>
          <button
            type="submit"
            className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
          >
            Save
          </button>
        </form>
        <p className="mt-3 max-w-[58ch] text-[11.5px] leading-[1.5] text-muted">
          Halt-at-cap is always on and enforced server-side: the cap is checked before every
          run is created <i>and</i> before every job the worker claims, so a runaway retry loop
          can&apos;t blow past it. Set a spend alert in the Anthropic Console as an independent
          backstop.
        </p>
      </section>
    </div>
  );
}
