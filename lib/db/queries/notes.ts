import { desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { companyNotes, users } from "../schema";

export const NOTE_MAX_CHARS = 5000;

export interface CompanyNoteRow {
  id: string;
  companyId: string;
  body: string;
  createdBy: string | null;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Newest first, with the author's display name resolved. */
export async function listNotesForCompany(companyId: string): Promise<CompanyNoteRow[]> {
  const rows = await db
    .select({
      id: companyNotes.id,
      companyId: companyNotes.companyId,
      body: companyNotes.body,
      createdBy: companyNotes.createdBy,
      authorName: sql<string | null>`
        COALESCE(NULLIF(TRIM(CONCAT(${users.firstName}, ' ', ${users.lastName})), ''), ${users.username})
      `,
      createdAt: companyNotes.createdAt,
      updatedAt: companyNotes.updatedAt,
    })
    .from(companyNotes)
    .leftJoin(users, eq(users.id, companyNotes.createdBy))
    .where(eq(companyNotes.companyId, companyId))
    .orderBy(desc(companyNotes.createdAt));
  return rows;
}

export async function addNote(input: {
  companyId: string;
  body: string;
  createdBy: string | null;
}): Promise<void> {
  await db.insert(companyNotes).values(input);
}

export async function getNote(noteId: string) {
  const rows = await db.select().from(companyNotes).where(eq(companyNotes.id, noteId)).limit(1);
  return rows[0] ?? null;
}

export async function updateNoteBody(noteId: string, body: string): Promise<void> {
  await db
    .update(companyNotes)
    .set({ body, updatedAt: new Date() })
    .where(eq(companyNotes.id, noteId));
}

export async function deleteNote(noteId: string): Promise<void> {
  await db.delete(companyNotes).where(eq(companyNotes.id, noteId));
}

export async function countNotesForCompany(companyId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT count(*)::int AS n FROM company_notes WHERE company_id = ${companyId}`,
  );
  return Number((result.rows[0] as { n: number } | undefined)?.n ?? 0);
}
