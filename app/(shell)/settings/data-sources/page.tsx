import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/db/queries/settings";
import { updateApolloAction, updateProviderAction } from "../admin-actions";

function KeyStatus({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="rounded-full bg-tier1-soft px-2 py-0.5 text-[10px] font-bold text-tier1">
      KEY CONFIGURED
    </span>
  ) : (
    <span className="rounded-full bg-[#FBF0DA] px-2 py-0.5 text-[10px] font-bold text-tier2">
      KEY MISSING
    </span>
  );
}

export default async function DataSourcesSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();
  const settings = await getSettings();
  const current = settings?.searchProvider ?? "brave";

  // presence only — the values never leave the server
  const braveConfigured = !!process.env.BRAVE_API_KEY;
  const googleConfigured = !!process.env.GOOGLE_CSE_KEY && !!process.env.GOOGLE_CSE_ID;
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;

  const providers = [
    {
      value: "brave",
      name: "Brave Search",
      cost: "$0 on the free tier (~2,000 queries/mo) — token-only, not free",
      note: "Good default. A 100-company run uses ~1,000 queries.",
      configured: braveConfigured,
    },
    {
      value: "google_cse",
      name: "Google Programmable Search",
      cost: "100 queries/day free, then $5 per 1,000",
      note: "Low daily ceiling — fine for small lists.",
      configured: googleConfigured,
    },
    {
      value: "anthropic",
      name: "Anthropic web search",
      cost: "$10 per 1,000 searches + retrieved-content tokens (≈ $6–10 extra per 100-company run)",
      note: "Least code, native citations, highest quality. The model searches for itself.",
      configured: anthropicConfigured,
    },
  ];

  const apolloConfigured = !!(process.env.APOLLO ?? process.env.APOLLO_API_KEY);
  const apolloEnabled = !!settings?.apolloEnabled;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Data sources</span>
        <span className="h-px flex-1 bg-line-2" />
      </p>
      <form action={updateProviderAction} className="flex flex-col gap-3">
        {providers.map((p) => (
          <label
            key={p.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[11px] border p-3.5 ${current === p.value ? "border-ink bg-[#FBFCFD]" : "border-line"}`}
          >
            <input type="radio" name="provider" value={p.value} defaultChecked={current === p.value} className="mt-1" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
                {p.name}
                <KeyStatus configured={p.configured} />
              </span>
              <span className="mono block text-[11px] text-slate">{p.cost}</span>
              <span className="block text-[12px] text-muted">{p.note}</span>
            </span>
          </label>
        ))}
        <p className="rounded-[10px] border border-line-2 bg-[#FBFCFD] px-3 py-2 text-[11.5px] text-slate">
          SEC EDGAR full-text search is always on — free, official, no key. API keys are set as
          Render environment variables, never stored in the app.
        </p>
        <button
          type="submit"
          className="w-max rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
        >
          Save
        </button>
      </form>
    </section>

    {/* Apollo contact enrichment (Phase 7) */}
    <section className="rounded-card border border-line bg-card p-5 shadow-card">
      <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
        <span>Contact enrichment — Apollo.io</span>
        <span className="h-px flex-1 bg-line-2" />
        <KeyStatus configured={apolloConfigured} />
      </p>
      <p className="mb-3 max-w-[62ch] text-[12.5px] leading-[1.5] text-slate">
        Finds target best contacts per company (IT-first; no CEO at $20M+ revenue, no C-level
        past $500M) and reveals email or direct phone only for contacts a user selects —
        credits are never spent in bulk. During analysis runs it also pulls organization
        firmographics (employees, revenue, locations, funding, tech stack) and recent news
        events as citable sources. Uses exactly four Apollo endpoints — People Search,
        People Enrichment (1 credit per email; mobile credit per phone), Organization
        Enrichment, and News Search. Scope the API key to those four only.
      </p>
      <form action={updateApolloAction} className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" name="enabled" defaultChecked={apolloEnabled} />
          Enable Apollo contact enrichment
        </label>
        <button
          type="submit"
          className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
        >
          Save
        </button>
        {apolloEnabled && !apolloConfigured && (
          <span className="text-[11.5px] font-medium text-tier2">
            Enabled, but the APOLLO env key is missing — set it in Render.
          </span>
        )}
      </form>
    </section>
    </div>
  );
}
