"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { generateInviteCode, inviteExpiresAt } from "@/lib/auth/invite";
import { headers } from "next/headers";
import {
  createInvite,
  deleteInvite,
  findInviteById,
  markInviteEmailSent,
  setInviteEmailError,
} from "@/lib/db/queries/invites";
import type { InviteRow } from "@/lib/db/queries/invites";
import { isResendConfigured, sendInviteEmail } from "@/lib/email/invite";
import { getActiveCompanyProfile } from "@/lib/db/queries/company-profiles";
import { findUserById as findAdminById } from "@/lib/db/queries/users";
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
  const trimmed = (key: string): string | null => {
    const v = String(formData.get(key) ?? "").trim();
    return v ? v.slice(0, 80) : null;
  };
  const email = trimmed("email");
  if (email && !z.string().email().safeParse(email).success) return;
  const invite = await createInvite({
    code: generateInviteCode(),
    role,
    firstName: trimmed("first_name"),
    lastName: trimmed("last_name"),
    email,
    createdBy: admin.id,
    expiresAt: inviteExpiresAt(new Date()),
  });

  // email the invite link via Resend (best-effort — the Copy-link button
  // remains the fallback; the list shows whether the email went out and,
  // on failure, the exact Resend error)
  await trySendInviteEmail(invite, admin.id);
  revalidatePath("/settings/users");
}

/** Send (or re-send) the invite email; record success or the exact failure. */
async function trySendInviteEmail(invite: InviteRow, adminId: string): Promise<void> {
  if (!invite.email) return;
  if (!isResendConfigured()) {
    await setInviteEmailError(
      invite.id,
      "RESEND_API_KEY is not configured on the web service.",
    );
    return;
  }
  try {
    const h = await headers();
    const origin =
      process.env.APP_URL?.replace(/\/$/, "") ??
      `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const [profile, adminUser] = await Promise.all([
      getActiveCompanyProfile(),
      findAdminById(adminId),
    ]);
    await sendInviteEmail({
      to: invite.email,
      firstName: invite.firstName,
      companyName: profile.name,
      inviteUrl: `${origin}/register?code=${invite.code}`,
      invitedBy:
        [adminUser?.firstName, adminUser?.lastName].filter(Boolean).join(" ") ||
        adminUser?.username ||
        null,
    });
    await markInviteEmailSent(invite.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("invite email failed:", message);
    await setInviteEmailError(invite.id, message).catch(() => {});
  }
}

/** "Email again" on an invite whose send failed (or needs re-delivery). */
export async function resendInviteEmailAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const invite = await findInviteById(id.data);
  if (!invite || invite.usedAt) return;
  await trySendInviteEmail(invite, admin.id);
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
