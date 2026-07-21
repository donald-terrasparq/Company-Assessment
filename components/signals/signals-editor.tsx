"use client";

/**
 * Signals tab (Phase 5): the signal library with strength sliders, global
 * weight controls, and the LIVE impact preview — scoring is a pure function,
 * so the browser recomputes every company's tier instantly as weights change.
 * Saving/applying is admin-only (server re-checks).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreCompany, type ScorableSignal, type Tier } from "@/lib/scoring/score";
import type { Category, WeightProfile } from "@/lib/scoring/default-weights";
import { SIGNAL_COPY, SIGNAL_GROUPS } from "@/lib/scoring/signal-copy";
import { strengthLabel } from "@/lib/scoring/weights-schema";

export interface PreviewCompany {
  resultId: string;
  tier: string;
  totalScore: number;
  fit: { industry: number; size: number; multi_location: number; geography: number };
  caveats: string[];
  signals: ScorableSignal[];
}

const CAT_CHIP: Record<Category, string> = {
  FWA: "bg-fwa-soft text-fwa",
  STARLINK: "bg-starlink-soft text-starlink",
  MOBILITY: "bg-mobility-soft text-mobility",
  BYOD: "bg-byod-soft text-byod",
};
const TIER_ORDER: Record<string, number> = { defunct: 0, tier_3: 1, tier_2: 2, tier_1: 3 };

const inputCls =
  "w-[64px] rounded-[8px] border border-line bg-card px-2 py-1 text-right text-[12.5px] mono text-ink outline-none focus:border-steel";

function Eyebrow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <p className="mb-3.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">
      <span>{children}</span>
      <span className="h-px flex-1 bg-line-2" />
      {right}
    </p>
  );
}

export function SignalsEditor({
  initialWeights,
  companies,
  isAdmin,
}: {
  initialWeights: WeightProfile;
  companies: PreviewCompany[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [weights, setWeights] = useState<WeightProfile>(() =>
    JSON.parse(JSON.stringify(initialWeights)),
  );
  const [profileName, setProfileName] = useState("Default");
  const [busy, setBusy] = useState<"save" | "apply" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const firedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of companies) {
      const seen = new Set(c.signals.map((s) => s.event_type));
      for (const t of seen) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [companies]);

  const fitSum =
    weights.fit.industry + weights.fit.size + weights.fit.multi_location + weights.fit.geography;

  // ---- LIVE preview: recompute every company with the edited weights ----
  const preview = useMemo(() => {
    const now = new Date();
    let promoted = 0;
    let demoted = 0;
    const changes: Array<{ resultId: string; from: string; to: string }> = [];
    const tierCounts: Record<Tier, number> = { tier_1: 0, tier_2: 0, tier_3: 0, defunct: 0 };
    for (const c of companies) {
      const next = scoreCompany(
        { fit: c.fit, signals: c.signals, caveats: c.caveats },
        weights,
        now,
      );
      tierCounts[next.tier]++;
      if (next.tier !== c.tier) {
        const dir = (TIER_ORDER[next.tier] ?? 0) - (TIER_ORDER[c.tier] ?? 0);
        if (dir > 0) promoted++;
        else demoted++;
        changes.push({ resultId: c.resultId, from: c.tier, to: next.tier });
      }
    }
    return { promoted, demoted, changed: changes.length, tierCounts };
  }, [companies, weights]);

  function setSignal(key: string, patch: Partial<{ base: number; enabled: boolean }>) {
    setWeights((w) => ({
      ...w,
      signals: { ...w.signals, [key]: { ...w.signals[key], ...patch } },
    }));
  }

  async function save(apply: boolean) {
    setBusy(apply ? "apply" : "save");
    setMessage(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName, weights, apply }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setMessage({
        ok: true,
        text: apply
          ? `Saved and re-scored ${body.rescored} companies across ${body.runsTouched} run(s) — zero API cost.`
          : "Profile saved. New runs and re-scores use these weights.",
      });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  const groups = SIGNAL_GROUPS.map((group) => ({
    group,
    keys: Object.keys(weights.signals).filter((k) => SIGNAL_COPY[k]?.group === group),
  })).filter((g) => g.keys.length > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-disp text-[20px] font-bold text-ink">Signals</h1>
        <span className="text-[12.5px] text-slate">
          Tune what counts as a buying signal — re-scoring is instant and free.
        </span>
        {!isAdmin && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-line-2 px-3 py-1 text-[11.5px] font-semibold text-slate">
            <Lock size={11} aria-hidden /> read-only preview — admins can save
          </span>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        {/* LEFT: library */}
        <div className="flex flex-col gap-5">
          {groups.map(({ group, keys }) => (
            <section key={group} className="rounded-card border border-line bg-card p-5 shadow-card">
              <Eyebrow>{group}</Eyebrow>
              {keys.map((key) => {
                const s = weights.signals[key];
                const copy = SIGNAL_COPY[key];
                const fired = firedCounts[key] ?? 0;
                return (
                  <div
                    key={key}
                    className={cn(
                      "mb-4 border-b border-line-2 pb-4 last:mb-0 last:border-none last:pb-0",
                      !s.enabled && "opacity-50",
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-disp text-[13.5px] font-semibold text-ink">
                        {copy.label}
                      </span>
                      {s.categories.map((c) => (
                        <span key={c} className={cn("rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold", CAT_CHIP[c])}>
                          {c}
                        </span>
                      ))}
                      <span className="mono ml-auto text-[10.5px] text-muted">
                        fired for {fired} of {companies.length}
                      </span>
                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={(e) => setSignal(key, { enabled: e.target.checked })}
                        />
                        on
                      </label>
                    </div>
                    <p className="mb-2 max-w-[62ch] text-[12px] leading-[1.45] text-slate">
                      {copy.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={s.base < 0 ? -60 : 0}
                        max={s.base < 0 ? 0 : 60}
                        value={s.base}
                        disabled={!s.enabled}
                        onChange={(e) => setSignal(key, { base: Number(e.target.value) })}
                        className="h-1.5 flex-1 accent-[#FF6B4A]"
                        aria-label={`${copy.label} strength`}
                      />
                      <span className="mono w-[34px] text-right text-[12.5px] font-bold text-ink">
                        {s.base}
                      </span>
                      <span
                        className={cn(
                          "w-[72px] rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold",
                          s.base >= 48 ? "bg-spark-soft text-spark" : s.base >= 35 ? "bg-tier1-soft text-tier1" : s.base < 0 ? "bg-line-2 text-slate" : "bg-line-2 text-slate",
                        )}
                      >
                        {strengthLabel(s.base)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}

          {/* global controls */}
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow>Global controls</Eyebrow>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[12px] font-semibold text-ink">
                  Fit weights{" "}
                  <span className={cn("mono", fitSum === 30 ? "text-muted" : "font-bold text-spark")}>
                    (total {fitSum}/30{fitSum !== 30 ? " — must equal 30 to save" : ""})
                  </span>
                </p>
                {(["industry", "size", "multi_location", "geography"] as const).map((k) => (
                  <label key={k} className="mb-1.5 flex items-center gap-2 text-[12px] text-slate">
                    <span className="w-[110px] capitalize">{k.replaceAll("_", " ")}</span>
                    <input
                      type="number"
                      value={weights.fit[k]}
                      min={0}
                      max={30}
                      onChange={(e) =>
                        setWeights((w) => ({ ...w, fit: { ...w.fit, [k]: Number(e.target.value) } }))
                      }
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold text-ink">Recency curve</p>
                {(Object.keys(weights.recency) as Array<keyof WeightProfile["recency"]>).map((k) => (
                  <label key={k} className="mb-1.5 flex items-center gap-2 text-[12px] text-slate">
                    <span className="mono w-[110px]">{k}</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={weights.recency[k]}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          recency: { ...w.recency, [k]: Number(e.target.value) },
                        }))
                      }
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold text-ink">Source confidence</p>
                {(["primary", "secondary", "weak"] as const).map((k) => (
                  <label key={k} className="mb-1.5 flex items-center gap-2 text-[12px] text-slate">
                    <span className="w-[110px] capitalize">{k}</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={weights.confidence[k]}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          confidence: { ...w.confidence, [k]: Number(e.target.value) },
                        }))
                      }
                      className={inputCls}
                    />
                  </label>
                ))}
                <p className="mb-2 mt-4 text-[12px] font-semibold text-ink">Tier thresholds</p>
                {(["tier_1_min", "tier_2_min"] as const).map((k) => (
                  <label key={k} className="mb-1.5 flex items-center gap-2 text-[12px] text-slate">
                    <span className="mono w-[110px]">{k}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weights.tiers[k]}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          tiers: { ...w.tiers, [k]: Number(e.target.value) },
                        }))
                      }
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold text-ink">Category boost</p>
                {(["FWA", "STARLINK", "MOBILITY", "BYOD"] as const).map((k) => (
                  <label key={k} className="mb-1.5 flex items-center gap-2 text-[12px] text-slate">
                    <span className="w-[110px]">{k}</span>
                    <input
                      type="number"
                      step={0.1}
                      min={0.5}
                      max={2}
                      value={weights.category_boost[k]}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          category_boost: { ...w.category_boost, [k]: Number(e.target.value) },
                        }))
                      }
                      className={inputCls}
                    />
                  </label>
                ))}
                <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-[10px] border border-line-2 bg-[#FBFCFD] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={weights.caveat_caps !== false}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, caveat_caps: e.target.checked }))
                    }
                    className="mt-0.5"
                  />
                  <span className="text-[11px] leading-[1.4] text-slate">
                    <b className="text-ink">Caveats cap Tier 1 → Tier 2.</b> When on, trust
                    caveats (enterprise procurement, holding company, overseas growth,
                    unconfirmed identity) hold a high scorer at &quot;monitor&quot;. Turn off to
                    let tiers follow scores alone — the caveat still shows on the row.
                  </span>
                </label>
                <div className="mt-2.5 flex items-start gap-2 rounded-[10px] border border-line-2 bg-[#FBFCFD] px-3 py-2.5">
                  <Lock size={13} className="mt-0.5 flex-shrink-0 text-muted" aria-hidden />
                  <p
                    className="text-[11px] leading-[1.4] text-slate"
                    title="A company with no source-backed signal can never be Tier 1, whatever its fit score. This is the product's core trust guarantee."
                  >
                    <b className="text-ink">Guardrail (locked):</b> fit alone can never produce
                    Tier 1 — a fresh, sourced signal is always required.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT: live impact + save */}
        <div className="sticky top-[86px] flex flex-col gap-5">
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <Eyebrow right={<span className="mono normal-case tracking-normal">{companies.length} companies</span>}>
              Live impact preview
            </Eyebrow>
            {companies.length === 0 ? (
              <p className="text-[12.5px] text-muted">
                Run an analysis first — the preview re-scores stored results as you tune weights.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[13.5px] font-medium text-ink">
                  {preview.changed === 0 ? (
                    "No tier changes with these weights."
                  ) : (
                    <>
                      <b className="text-spark">{preview.changed}</b> compan
                      {preview.changed === 1 ? "y changes" : "ies change"} tier —{" "}
                      <b className="text-tier1">{preview.promoted} promoted</b>,{" "}
                      <b className="text-tier2">{preview.demoted} demoted</b>
                    </>
                  )}
                </p>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      ["tier_1", "Tier 1 · approach now", "bg-tier1"],
                      ["tier_2", "Tier 2 · monitor", "bg-tier2"],
                      ["tier_3", "Tier 3 · low / stale", "bg-tier3"],
                      ["defunct", "Defunct", "bg-[#C6CCD6]"],
                    ] as const
                  ).map(([tier, label, cls]) => (
                    <div key={tier} className="flex items-center gap-2 text-[12px] text-slate">
                      <span className={cn("h-[9px] w-[9px] rounded-[3px]", cls)} />
                      <span className="flex-1">{label}</span>
                      <span className="mono font-bold text-ink">{preview.tierCounts[tier]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {isAdmin && (
            <section className="rounded-card border border-line bg-card p-5 shadow-card">
              <Eyebrow>Save profile</Eyebrow>
              <label className="mb-3 flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-slate">Profile name</span>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="rounded-[10px] border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none focus:border-steel"
                />
              </label>
              {message && (
                <p
                  className={cn(
                    "mb-3 rounded-[10px] px-3 py-2 text-[12px] font-medium",
                    message.ok ? "bg-tier1-soft text-tier1" : "bg-spark-soft text-spark",
                  )}
                >
                  {message.text}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy !== null || fitSum !== 30}
                  onClick={() => save(false)}
                  className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-[#cdd4de] disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save profile"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null || fitSum !== 30}
                  onClick={() => save(true)}
                  className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1b2d43] disabled:opacity-50"
                >
                  {busy === "apply" ? "Applying…" : "Save & apply to all lists"}
                </button>
                <p className="text-[10.5px] leading-[1.4] text-muted">
                  Applying re-scores stored signals — no API calls, no cost.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
