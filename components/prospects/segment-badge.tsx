/**
 * The colored B2B-segment indicator (ENT / MM / SMB) that replaces the
 * monogram letter box on the Prospects table and detail header. Renders in
 * both server and client components.
 */
import { classifySegment, SEGMENT_META } from "@/lib/scoring/segment";

export function SegmentBadge({
  employees,
  annualRevenueUsd,
  sizeLabel,
  size = "sm",
}: {
  employees: number | null;
  annualRevenueUsd: number | null;
  sizeLabel?: string | null;
  size?: "sm" | "lg";
}) {
  const segment = classifySegment({ employees, annualRevenueUsd, sizeLabel });
  const meta = segment ? SEGMENT_META[segment] : null;
  const cls =
    size === "lg"
      ? "grid h-[60px] w-[60px] flex-shrink-0 place-items-center rounded-[15px] font-disp text-[15px] font-bold text-white"
      : "grid h-10 w-10 flex-shrink-0 place-items-center rounded-[11px] font-disp text-[11px] font-bold tracking-[.02em] text-white";

  if (!meta) {
    return (
      <div
        title="Segment unknown — no headcount or revenue found"
        className={cls}
        style={{ background: "#98A2B2" }}
      >
        —
      </div>
    );
  }
  return (
    <div title={meta.hint} className={cls} style={{ background: meta.color }}>
      {meta.short}
    </div>
  );
}
