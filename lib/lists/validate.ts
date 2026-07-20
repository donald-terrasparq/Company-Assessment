/**
 * Pure list-upload validation + dedupe (no I/O). POST /api/lists calls this so
 * the 100-company cap is enforced server-side even when the client is bypassed
 * (hard rule 9 in CLAUDE.md).
 */
import { z } from "zod";
import { normalizeDomain } from "@/lib/normalize/domain";

export const MAX_COMPANIES_PER_LIST = 100;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const UploadRowSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  website: z.string().trim().max(500).optional().nullable(),
  raw: z.record(z.string(), z.unknown()).default({}),
});
export type UploadRow = z.infer<typeof UploadRowSchema>;

export const ListPayloadSchema = z.object({
  name: z.string().trim().min(1, "List name is required.").max(80),
  filename: z.string().trim().min(1).max(255),
  rows: z.array(UploadRowSchema).min(1, "The file has no company rows."),
});
export type ListPayload = z.infer<typeof ListPayloadSchema>;

export type ValidationResult =
  | { ok: true; payload: ListPayload }
  | { ok: false; status: number; message: string };

/** Validates shape AND the cap — the 422 message names the actual count. */
export function validateListPayload(input: unknown): ValidationResult {
  const parsed = ListPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      message: parsed.error.issues[0]?.message ?? "Invalid upload payload.",
    };
  }
  const count = parsed.data.rows.length;
  if (count > MAX_COMPANIES_PER_LIST) {
    return {
      ok: false,
      status: 422,
      message: `This file has ${count} companies. The limit is ${MAX_COMPANIES_PER_LIST} per list — split it into two lists.`,
    };
  }
  return { ok: true, payload: parsed.data };
}

/** `"{name} — {YYYY-MM-DD}"`, computed server-side (docs/00-PRD.md). */
export function buildDisplayName(name: string, now: Date): string {
  return `${name.trim()} — ${now.toISOString().slice(0, 10)}`;
}

export interface DedupedRow {
  name: string;
  website: string | null;
  domain: string | null;
}

export interface DedupeOutcome {
  rows: DedupedRow[];
  rawByIndex: Array<Record<string, unknown>>;
  duplicatesRemoved: number;
  unparseableUrls: number;
}

/** Dedupe within a list on normalized domain, else normalized name (docs/00-PRD.md). */
export function dedupeRows(rows: UploadRow[]): DedupeOutcome {
  const seen = new Set<string>();
  const out: DedupedRow[] = [];
  const rawByIndex: Array<Record<string, unknown>> = [];
  let duplicatesRemoved = 0;
  let unparseableUrls = 0;

  for (const row of rows) {
    const website = row.website?.trim() ? row.website.trim() : null;
    const domain = normalizeDomain(website);
    if (website && !domain) unparseableUrls++;
    const key = domain ?? `name:${row.company_name.trim().toLowerCase()}`;
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);
    out.push({ name: row.company_name.trim(), website, domain });
    rawByIndex.push(row.raw);
  }
  return { rows: out, rawByIndex, duplicatesRemoved, unparseableUrls };
}
