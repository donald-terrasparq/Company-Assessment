"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isInviteUsable } from "@/lib/auth/invite";
import { findInviteByCode, markInviteUsed } from "@/lib/db/queries/invites";
import { getSettings } from "@/lib/db/queries/settings";
import { createUser, findUserByUsername } from "@/lib/db/queries/users";

const RegisterSchema = z.object({
  code: z.string().trim().optional().default(""),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(40, "Username must be at most 40 characters.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dots, dashes and underscores only."),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function registerAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = RegisterSchema.safeParse({
    code: formData.get("code") ?? "",
    username: formData.get("username"),
    email: formData.get("email") ?? "",
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }
  const { code, username, email, password } = parsed.data;

  // Either a usable invite code, or open registration explicitly enabled (ships off).
  let invite = null;
  if (code) {
    invite = (await findInviteByCode(code)) ?? null;
    if (!invite || !isInviteUsable(invite, new Date())) {
      return "This invite link is invalid, expired, or already used.";
    }
  } else {
    const settings = await getSettings();
    if (!settings?.allowOpenRegistration) {
      return "Registration requires an invite link from your admin.";
    }
  }

  if (await findUserByUsername(username)) {
    return "That username is taken.";
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({
    username,
    email: email || null,
    passwordHash,
    role: invite?.role ?? "member",
  });
  if (invite) {
    await markInviteUsed(invite.id, user.id);
  }

  redirect("/login?registered=1");
}
