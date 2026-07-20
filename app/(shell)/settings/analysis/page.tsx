import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/db/queries/settings";
import { BALANCED_MODEL, HIGH_ACCURACY_MODEL } from "@/lib/anthropic/models";
import { SEARCHES_PER_COMPANY } from "@/lib/research/gather";
import { updateModelAction } from "../admin-actions";

export default async function AnalysisSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();
  const settings = await getSettings();
  const highAccuracy = settings?.model === HIGH_ACCURACY_MODEL;

  return (
    <section className="max-w-2xl rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Analysis</span>
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
  );
}
