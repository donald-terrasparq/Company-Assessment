import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../client";
import { invites } from "../schema";

export type InviteRow = typeof invites.$inferSelect;

export async function createInvite(input: {
  code: string;
  role: "admin" | "member";
  createdBy: string;
  expiresAt: Date;
}): Promise<InviteRow> {
  const rows = await db.insert(invites).values(input).returning();
  return rows[0];
}

export async function findInviteByCode(code: string): Promise<InviteRow | undefined> {
  const rows = await db.select().from(invites).where(eq(invites.code, code)).limit(1);
  return rows[0];
}

/** Unused, unexpired invites — what the Users tab lists. */
export async function listOpenInvites(): Promise<InviteRow[]> {
  return db
    .select()
    .from(invites)
    .where(and(isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
    .orderBy(desc(invites.createdAt));
}

export async function markInviteUsed(id: string, userId: string): Promise<void> {
  await db
    .update(invites)
    .set({ usedBy: userId, usedAt: new Date() })
    .where(eq(invites.id, id));
}

export async function deleteInvite(id: string): Promise<void> {
  await db.delete(invites).where(eq(invites.id, id));
}
