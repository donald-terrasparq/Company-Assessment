"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { generateInviteCode, inviteExpiresAt } from "@/lib/auth/invite";
import { headers } from "next/headers";
import { createInvite, deleteInvite, markInviteEmailSent } from "@/lib/db/queries/invites";
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
  // remains the fallback; the list shows whether the email went out)
  if (email && isResendConfigured()) {
    try {
      const h = await headers();
      const origin =
        process.env.APP_URL?.replace(/\/$/, "") ??
        `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
      const [profile, adminUser] = await Promise.all([
        getActiveCompanyProfile(),
        findAdminById(admin.id),
      ]);
      await sendInviteEmail({
        to: email,
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
      console.error("invite email failed:", err);
    }
  }
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
