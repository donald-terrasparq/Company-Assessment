import { eq } from "drizzle-orm";
import { db } from "../client";
import { users } from "../schema";

export type UserRow = typeof users.$inferSelect;

export async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0];
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function listUsers(): Promise<UserRow[]> {
  return db.select().from(users).orderBy(users.createdAt);
}

export async function createUser(input: {
  username: string;
  email?: string | null;
  passwordHash: string;
  role: "admin" | "member";
}): Promise<UserRow> {
  const rows = await db
    .insert(users)
    .values({
      username: input.username,
      email: input.email ?? null,
      passwordHash: input.passwordHash,
      role: input.role,
    })
    .returning();
  return rows[0];
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  await db.update(users).set({ isActive }).where(eq(users.id, id));
}
