"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { generateInviteCode, inviteExpiresAt } from "@/lib/auth/invite";
import { createInvite, deleteInvite } from "@/lib/db/queries/invites";
import { setAllowOpenRegistration } from "@/lib/db/queries/settings";
import { findUserById, setUserActive } from "@/lib/db/queries/users";

/** Every action here re-checks the session server-side — never trust the client. */
async function requireAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return { id: session.user.id };
}

export async function createInviteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const role = z.enum(["admin", "member"]).catch("member").parse(formData.get("role"));
  await createInvite({
    code: generateInviteCode(),
    role,
    createdBy: admin.id,
    expiresAt: inviteExpiresAt(new Date()),
  });
  revalidatePath("/settings/users");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await deleteInvite(id.data);
  revalidatePath("/settings/users");
}

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success || id.data === admin.id) return; // never deactivate yourself

  const user = await findUserById(id.data);
  if (!user) return;
  await setUserActive(user.id, !user.isActive);
  revalidatePath("/settings/users");
}

export async function toggleOpenRegistrationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  await setAllowOpenRegistration(formData.get("enable") === "true");
  revalidatePath("/settings/users");
}
