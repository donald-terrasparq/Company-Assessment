import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { listProfiles } from "@/lib/db/queries/company-profiles";
import { PRODUCT_SLOTS } from "@/lib/company/profile";
import {
  activateCompanyProfileAction,
  addCompanyProfileAction,
  saveCompanyProfileAction,
} from "../admin-actions";

const inputCls =
  "w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-[13px] text-ink outline-none focus:border-steel";

/**
 * Settings → Company (admin-only): the re-brandable seller profile. The ACTIVE
 * profile defines who the tool sells for — company facts, the four target
 * products, and the AI context that steers research, signals, and emails.
 * ADD creates another profile so the same tool serves a different company or
 * industry; activate it to switch.
 */
export default async function CompanySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();

  const [{ profile: profileParam }, profiles] = await Promise.all([
    searchParams,
    listProfiles(),
  ]);
  const selected =
    profiles.find((p) => p.id === profileParam) ??
    profiles.find((p) => p.isActive) ??
    profiles[0];

  if (!selected) {
    return (
      <p className="text-[13px] text-muted">
        No company profiles found — run the database migration (npm run db:migrate).
      </p>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* profile selector + ADD */}
      <section className="rounded-card border border-line bg-card p-5 shadow-card">
        <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>Company profiles</span>
          <span className="h-px flex-1 bg-line-2" />
          <span className="mono normal-case tracking-normal">
            active profile drives searches, signals &amp; emails
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {profiles.map((p) => (
            <a
              key={p.id}
              href={`/settings/company?profile=${p.id}`}
              className={`flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                p.id === selected.id
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-card text-slate hover:border-[#cdd4de]"
              }`}
            >
              {p.name}
              {p.isActive && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    p.id === selected.id ? "bg-white/20 text-white" : "bg-tier1-soft text-tier1"
                  }`}
                >
                  ACTIVE
                </span>
              )}
            </a>
          ))}
          <form action={addCompanyProfileAction}>
            <button
              type="submit"
              className="rounded-[10px] border border-dashed border-line bg-card px-3.5 py-2 text-[13px] font-medium text-slate hover:border-[#cdd4de] hover:text-ink"
            >
              + Add company
            </button>
          </form>
          {!selected.isActive && selected.id && (
            <form action={activateCompanyProfileAction} className="ml-auto">
              <input type="hidden" name="id" value={selected.id} />
              <button
                type="submit"
                className="rounded-[10px] border border-ink bg-ink px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
              >
                Make active
              </button>
            </form>
          )}
        </div>
      </section>

      {/* edit form */}
      <form
        action={saveCompanyProfileAction}
        className="flex flex-col gap-5 rounded-card border border-line bg-card p-5 shadow-card"
      >
        <input type="hidden" name="id" value={selected.id} />
        <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
          <span>{selected.name}</span>
          <span className="h-px flex-1 bg-line-2" />
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-slate">Company name</span>
            <input name="name" defaultValue={selected.name} required className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-slate">Company website</span>
            <input name="website" defaultValue={selected.website} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-slate">Industry</span>
            <input name="industry" defaultValue={selected.industry} className={inputCls} />
          </label>
        </div>

        <div>
          <p className="mb-1 text-[12px] font-semibold text-ink">
            Target products for sales signals (up to 4)
          </p>
          <p className="mb-3 text-[11.5px] leading-[1.45] text-muted">
            Each product maps onto one of the four internal signal slots ({PRODUCT_SLOTS.join(" / ")}).
            The description tells the AI analyst when this product is sold — it directly shapes
            which events count as buying signals.
          </p>
          <div className="flex flex-col gap-3">
            {selected.products.map((p, i) => (
              <div key={p.slot} className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <label className="flex flex-col gap-1">
                  <span className="mono text-[10.5px] font-bold text-muted">{p.slot}</span>
                  <input name={`product_label_${i}`} defaultValue={p.label} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold text-muted">When it&apos;s sold</span>
                  <textarea
                    name={`product_desc_${i}`}
                    defaultValue={p.description}
                    rows={2}
                    className={`${inputCls} resize-y`}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[12px] font-semibold text-ink">AI context</p>
          <p className="mb-3 text-[11.5px] leading-[1.45] text-muted">
            The supportive text the app feeds the AI to customize research and outreach for
            this company. All three are used verbatim in prompts.
          </p>
          <label className="mb-3 flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-slate">
              Company description — used in drafted emails
            </span>
            <textarea
              name="company_description"
              defaultValue={selected.aiContext.companyDescription}
              rows={3}
              className={`${inputCls} resize-y`}
            />
          </label>
          <label className="mb-3 flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-slate">
              Signal guidance — extra instructions for the research analyst
            </span>
            <textarea
              name="signal_guidance"
              defaultValue={selected.aiContext.signalGuidance}
              rows={3}
              className={`${inputCls} resize-y`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-slate">
              Search themes — comma-separated hints for finding signals
            </span>
            <input
              name="search_keywords"
              defaultValue={selected.aiContext.searchKeywords}
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
          >
            Save profile
          </button>
          <span className="text-[11px] text-muted">
            Changes apply to new runs and newly drafted emails.
            {selected.isActive ? "" : " This profile is inactive until you make it active."}
          </span>
        </div>
      </form>
    </div>
  );
}
