"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, signOut } from "@/auth";
import { findUserById, updateUserPassword } from "@/lib/db/queries/users";

const ChangePasswordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().min(8, "New password must be at least 8 characters."),
});

export type ChangePasswordState = { ok: boolean; message: string } | undefined;

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Not signed in." };

  const parsed = ChangePasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await findUserById(session.user.id);
  if (!user) return { ok: false, message: "Account not found." };

  const valid = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!valid) return { ok: false, message: "Current password is incorrect." };

  await updateUserPassword(user.id, await bcrypt.hash(parsed.data.next, 12));
  return { ok: true, message: "Password updated." };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
