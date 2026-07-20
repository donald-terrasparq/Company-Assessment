/**
 * Zod schemas for every LLM JSON response (hard rule: model output is
 * untrusted input — validate before it touches SQL). Mirrors docs/06-PROMPTS.md.
 */
import { z } from "zod";

export const CategorySchema = z.enum(["FWA", "STARLINK", "MOBILITY", "BYOD"]);

export const ExtractedSignalSchema = z.object({
  event_type: z.string(),
  categories: z.array(CategorySchema).min(1),
  title: z.string().min(1),
  summary: z.string().min(1).max(400), // paraphrased, ≤ 40 words
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  is_forward: z.boolean(),
  source_url: z.string().url(),
  source_name: z.string().nullable().catch(null),
  source_class: z.enum(["primary", "secondary", "weak"]),
});

export const ExtractedContactSchema = z.object({
  name: z.string().min(1),
  title: z.string().nullable().catch(null),
  role_rationale: z.string().nullable().catch(null),
  linkedin_url: z.string().url().nullable().catch(null),
  source_url: z.string().url().nullable().catch(null),
});

/** Coverage & caveats panel rows — good/warn observations about sellability. */
export const CoverageNoteSchema = z.object({
  tone: z.enum(["good", "warn"]).catch("warn"),
  note: z.string().min(1).max(300),
});
export type CoverageNote = z.infer<typeof CoverageNoteSchema>;

export const SignalExtractionSchema = z.object({
  industry: z.string().nullable().catch(null),
  hq: z.string().nullable().catch(null),
  size_label: z.string().nullable().catch(null),
  employee_estimate: z.number().int().nullable().catch(null),
  annual_revenue_usd: z.number().nullable().catch(null),
  location_count: z.number().int().nullable().catch(null),
  fit: z.object({
    industry: z.number(),
    size: z.number(),
    multi_location: z.number(),
    geography: z.number(),
    rationale: z.string().catch(""),
  }),
  signals: z.array(ExtractedSignalSchema),
  caveats: z.array(z.string()).catch([]),
  why_now: z.string().catch(""),
  // 3–5 concise steps; older responses may return one string — both accepted
  recommended_play: z.union([z.array(z.string()), z.string()]).catch(""),
  coverage: z.array(CoverageNoteSchema).max(4).catch([]),
  contacts: z.array(ExtractedContactSchema).max(4).catch([]),
});

export type SignalExtraction = z.infer<typeof SignalExtractionSchema>;

/** Stage-1 identity resolution output (docs/06-PROMPTS.md). */
export const DomainResolutionSchema = z.object({
  domain: z.string().nullable(),
  evidence_url: z.string().url().nullable().catch(null),
});
export type DomainResolution = z.infer<typeof DomainResolutionSchema>;

export const ALLOWED_CAVEATS = [
  "defunct",
  "enterprise_procurement",
  "foreign_hq",
  "overseas_growth",
  "holding_company",
  "franchise_model",
  "single_site",
  "public_procurement",
  "identity_unconfirmed",
] as const;
