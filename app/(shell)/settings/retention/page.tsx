import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/db/queries/settings";
import { updateRetentionAction } from "../admin-actions";

export default async function RetentionSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();
  const settings = await getSettings();

  return (
    <section className="max-w-2xl rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Retention</span>
        <span className="h-px flex-1 bg-line-2" />
      </p>
      <form action={updateRetentionAction} className="flex items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-slate">Keep runs for (days)</span>
          <input
            name="days"
            type="number"
            min={30}
            max={3650}
            defaultValue={settings?.retentionDays ?? 365}
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
        A daily sweep inside the worker soft-deletes runs older than this and drops their
        stored signals (the bulky part). Lists and companies are always kept — re-running a
        list later still works. Minimum 30 days.
      </p>
    </section>
  );
}
