import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/db/queries/settings";
import { BALANCED_MODEL, HIGH_ACCURACY_MODEL } from "@/lib/anthropic/models";
import { SEARCHES_PER_COMPANY } from "@/lib/research/gather";
import { updateEscalationAction, updateModelAction } from "../admin-actions";
import { cn } from "@/lib/utils";

export default async function AnalysisSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();
  const settings = await getSettings();
  const highAccuracy = settings?.model === HIGH_ACCURACY_MODEL;
  const escalationPct = settings?.escalationPct ?? 20;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Base model</span>
        <span className="h-px flex-1 bg-line-2" />
      </p>
      <form action={updateModelAction} className="flex flex-col gap-3">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-[11px] border p-3.5 ${!highAccuracy ? "border-ink bg-[#FBFCFD]" : "border-line"}`}
        >
          <input type="radio" name="mode" value="balanced" defaultChecked={!highAccuracy} className="mt-1" />
          <span>
            <span className="block text-[13.5px] font-semibold text-ink">
              Balanced <span className="mono text-[11px] font-normal text-muted">{BALANCED_MODEL}</span>
            </span>
            <span className="text-[12.5px] text-slate">
              The cost/quality sweet spot for per-company research. Recommended default.
            </span>
          </span>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-[11px] border p-3.5 ${highAccuracy ? "border-ink bg-[#FBFCFD]" : "border-line"}`}
        >
          <input type="radio" name="mode" value="high_accuracy" defaultChecked={highAccuracy} className="mt-1" />
          <span>
            <span className="block text-[13.5px] font-semibold text-ink">
              High accuracy <span className="mono text-[11px] font-normal text-muted">{HIGH_ACCURACY_MODEL}</span>
            </span>
            <span className="text-[12.5px] text-slate">
              Deeper extraction at roughly 3–5× the token cost. Use for lists that matter most.
            </span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="w-max rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
          >
            Save
          </button>
          <span className="mono text-[11px] text-muted">
            {SEARCHES_PER_COMPANY} searches per company · applies to new runs only
          </span>
        </div>
      </form>
    </section>

    {/* two-pass escalation (default on at 20%) */}
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Two-pass escalation</span>
        <span className="h-px flex-1 bg-line-2" />
        <span className="mono normal-case tracking-normal">
          {escalationPct === 0 ? "off" : `up to ${escalationPct}% escalated`}
        </span>
      </p>
      <p className="mb-3 max-w-[62ch] text-[12.5px] leading-[1.5] text-slate">
        Every company gets a Balanced first pass. Companies matching escalation triggers —
        failed extraction, borderline tier, unconfirmed identity, high fit with thin evidence,
        suspicious footprint, weak-only sources — are automatically re-analyzed with the
        high-accuracy model, capped at this share of the list. 0% turns the second pass off.
        (Only applies when the base model is Balanced.)
      </p>
      <form action={updateEscalationAction} className="flex flex-wrap gap-2">
        {[0, 20, 40, 60, 80, 100].map((pct) => (
          <button
            key={pct}
            type="submit"
            name="pct"
            value={pct}
            className={cn(
              "mono rounded-[20px] border px-4 py-1.5 text-[13px] font-bold transition-colors",
              escalationPct === pct
                ? "border-ink bg-ink text-white"
                : "border-line bg-card text-slate hover:border-[#cdd4de] hover:text-ink",
            )}
          >
            {pct}%
          </button>
        ))}
      </form>
      <p className="mono mt-3 text-[11px] text-muted">
        Cost guide per 100 companies: Balanced-only ≈ $12 · +20% escalation ≈ $19 · +100% ≈ $46
      </p>
    </section>
    </div>
  );
}
