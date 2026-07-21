import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/db/queries/settings";
import {
  DEPARTMENT_OPTIONS,
  parseContactPrefs,
  SENIORITY_OPTIONS,
} from "@/lib/apollo/prefs";
import { updateContactDefaultsAction } from "../admin-actions";

/**
 * Settings → Contacts (admin-only): default Apollo contact-search filters.
 * These drive the automatic per-run search and pre-fill the quick filters on
 * every company's Top Contacts card.
 */
export default async function ContactsSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();
  const settings = await getSettings();
  const prefs = parseContactPrefs(settings?.contactDefaults);

  return (
    <section className="max-w-2xl rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Contact search defaults — Apollo</span>
        <span className="h-px flex-1 bg-line-2" />
      </p>
      <p className="mb-4 max-w-[64ch] text-[12.5px] leading-[1.5] text-slate">
        Who counts as a &quot;best contact&quot;. Applied automatically at the end of every
        analysis run and pre-filled on each company&apos;s Top Contacts card, where users can
        adjust per search. The size guardrail always overlays these: no CEO at $20M+ revenue,
        no C-level past $500M — even if C-Level is checked here.
      </p>

      <form action={updateContactDefaultsAction} className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">Seniority</p>
          <div className="flex flex-wrap gap-2">
            {SENIORITY_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[12.5px] text-ink has-[:checked]:border-ink has-[:checked]:bg-[#FBFCFD]"
              >
                <input
                  type="checkbox"
                  name="seniorities"
                  value={o.value}
                  defaultChecked={prefs.seniorities.includes(o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">Department</p>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENT_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[12.5px] text-ink has-[:checked]:border-ink has-[:checked]:bg-[#FBFCFD]"
              >
                <input
                  type="checkbox"
                  name="departments"
                  value={o.value}
                  defaultChecked={prefs.departments.includes(o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Procurement has no Apollo department — selecting it targets procurement /
            purchasing / sourcing job titles instead.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">Title keywords</p>
          <input
            name="titles"
            defaultValue={prefs.titles.join(", ")}
            placeholder="VP, Manager, Senior Manager"
            className="w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13px] text-ink outline-none focus:border-steel"
          />
          <p className="mt-1.5 text-[11px] text-muted">
            Comma-separated, matched loosely against job titles (up to 12).
          </p>
        </div>

        <button
          type="submit"
          className="w-max rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
        >
          Save defaults
        </button>
      </form>
    </section>
  );
}
