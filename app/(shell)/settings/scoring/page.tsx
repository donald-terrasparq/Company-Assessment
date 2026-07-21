import { forbidden } from "next/navigation";
import { auth } from "@/auth";
import { getDefaultProfile } from "@/lib/db/queries/profiles";
import { loadPreviewCompanies } from "@/lib/db/queries/preview";
import { DEFAULT_WEIGHTS, type WeightProfile } from "@/lib/scoring/default-weights";
import { GlobalControlsEditor } from "@/components/settings/global-controls";

/** Settings → Scoring: the global weight controls, moved off the Signals tab. */
export default async function ScoringSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") forbidden();

  const [profile, companies] = await Promise.all([getDefaultProfile(), loadPreviewCompanies()]);
  const weights = (profile?.weights as WeightProfile) ?? DEFAULT_WEIGHTS;

  return (
    <div>
      <p className="mb-4 max-w-[70ch] text-[12.5px] leading-[1.5] text-slate">
        Fit weights, recency curve, source confidence, tier thresholds, and category boosts.
        These apply to every list; individual signal strengths stay on the Signals tab.
      </p>
      <GlobalControlsEditor initialWeights={weights} companies={companies} />
    </div>
  );
}
