/**
 * The signature element (docs/04-UI-SPEC.md): every 0–100 score renders as a
 * steel Fit segment + tier-colored Trigger segment on a 0–100 track, with a
 * coral pulse when the trigger is fresh (<30d or forward). Never a plain
 * progress bar.
 */
import { cn } from "@/lib/utils";

const TIER_COLOR: Record<string, string> = {
  tier_1: "bg-tier1",
  tier_2: "bg-tier2",
  tier_3: "bg-tier3",
  defunct: "bg-[#C6CCD6]",
};

export function isFreshLabel(recencyLabel: string | null): boolean {
  return recencyLabel === "<30d" || recencyLabel === "forward";
}

export function ScoreAnatomyBar({
  fit,
  trigger,
  tier,
  fresh,
  height = 9,
  showLabels = true,
}: {
  fit: number;
  trigger: number;
  tier: string;
  fresh: boolean;
  height?: number;
  showLabels?: boolean;
}) {
  return (
    <div className="min-w-[70px] flex-1">
      <div
        role="img"
        aria-label={`Score ${fit + trigger} of 100: fit ${fit}, trigger ${trigger}`}
        className="relative flex overflow-visible rounded-md bg-line-2"
        style={{ height }}
      >
        <div
          className="h-full rounded-l-md bg-steel"
          style={{ width: `${Math.min(fit, 100)}%` }}
        />
        <div
          className={cn("relative h-full rounded-r-md", TIER_COLOR[tier] ?? "bg-tier3")}
          style={{ width: `${Math.min(trigger, 100 - Math.min(fit, 100))}%` }}
        >
          {fresh && (
            <span className="absolute -right-[3px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 animate-spark-pulse rounded-full bg-spark shadow-[0_0_0_3px_var(--spark-soft)]" />
          )}
        </div>
      </div>
      {showLabels && (
        <div className="mono mt-1.5 flex gap-2.5 text-[10px] text-muted">
          <span>
            <b className="text-slate">fit</b> {fit}
          </span>
          <span>
            <b className="text-slate">trig</b> {trigger}
          </span>
        </div>
      )}
    </div>
  );
}
