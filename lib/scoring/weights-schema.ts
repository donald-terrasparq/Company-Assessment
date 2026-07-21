/** Zod validation for edited weight profiles (Signals tab → save). */
import { z } from "zod";
import type { WeightProfile } from "./default-weights";

const CategoryEnum = z.enum(["FWA", "STARLINK", "MOBILITY", "BYOD"]);
const mult = z.number().min(0).max(1);

export const WeightProfileSchema = z.object({
  version: z.literal(1),
  fit: z.object({
    industry: z.number().int().min(0).max(30),
    size: z.number().int().min(0).max(30),
    multi_location: z.number().int().min(0).max(30),
    geography: z.number().int().min(0).max(30),
  }),
  recency: z.object({
    forward: mult,
    lt_30d: mult,
    m1_3: mult,
    m4_5: mult,
    m6_12: mult,
    gt_12m: mult,
  }),
  confidence: z.object({ primary: mult, secondary: mult, weak: mult }),
  tiers: z
    .object({
      tier_1_min: z.number().int().min(1).max(100),
      tier_2_min: z.number().int().min(0).max(99),
    })
    .refine((t) => t.tier_1_min > t.tier_2_min, {
      message: "Tier 1 threshold must be above Tier 2.",
    }),
  caveat_caps: z.boolean().catch(true),
  signals: z.record(
    z.string(),
    z.object({
      base: z.number().int().min(-60).max(60),
      categories: z.array(CategoryEnum),
      enabled: z.boolean(),
    }),
  ),
  category_boost: z.object({
    FWA: z.number().min(0.5).max(2),
    STARLINK: z.number().min(0.5).max(2),
    MOBILITY: z.number().min(0.5).max(2),
    BYOD: z.number().min(0.5).max(2),
  }),
});

export function parseWeightProfile(input: unknown):
  | { ok: true; weights: WeightProfile }
  | { ok: false; message: string } {
  const parsed = WeightProfileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `${issue?.path.join(".")}: ${issue?.message}` };
  }
  return { ok: true, weights: parsed.data as WeightProfile };
}

/** Signal strength label for the slider (docs/04-UI-SPEC.md Signals tab). */
export function strengthLabel(base: number): string {
  if (base === 0) return "Ignored";
  if (base < 0) return "Penalty";
  if (base < 20) return "Weak";
  if (base < 35) return "Moderate";
  if (base < 48) return "Strong";
  return "Decisive";
}
