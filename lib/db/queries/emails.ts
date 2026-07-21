import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { draftedEmails } from "../schema";

export type DraftedEmailRow = typeof draftedEmails.$inferSelect;

export async function saveDraftedEmail(input: {
  companyId: string;
  contactName: string | null;
  playText: string;
  styleKey: string;
  sequencePosition: number;
  sequenceLength: number;
  subject: string;
  body: string;
  createdBy: string | null;
}): Promise<void> {
  await db.insert(draftedEmails).values(input);
}

const HISTORY_CAP = 50;

/** Newest first — the Email history card on the company detail page. */
export async function listDraftedEmailsForCompany(companyId: string): Promise<DraftedEmailRow[]> {
  try {
    return await db
      .select()
      .from(draftedEmails)
      .where(eq(draftedEmails.companyId, companyId))
      .orderBy(desc(draftedEmails.createdAt))
      .limit(HISTORY_CAP);
  } catch {
    return []; // table missing (pre-0010 DB)
  }
}
