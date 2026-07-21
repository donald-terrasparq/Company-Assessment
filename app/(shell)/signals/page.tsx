import { auth } from "@/auth";
import { getDefaultProfile } from "@/lib/db/queries/profiles";
import { loadPreviewCompanies } from "@/lib/db/queries/preview";
import { DEFAULT_WEIGHTS, type WeightProfile } from "@/lib/scoring/default-weights";
import { SignalsEditor } from "@/components/signals/signals-editor";

export default async function SignalsPage() {
  const [session, profile, companies] = await Promise.all([
    auth(),
    getDefaultProfile(),
    loadPreviewCompanies(),
  ]);
  const isAdmin = session?.user.role === "admin";
  const weights = (profile?.weights as WeightProfile) ?? DEFAULT_WEIGHTS;

  return <SignalsEditor initialWeights={weights} companies={companies} isAdmin={isAdmin} />;
}
