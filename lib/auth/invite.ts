/**
 * Pure invite-code logic (no I/O, unit-testable). DB reads/writes live in
 * lib/db/queries/invites.ts; this file owns generation and validity rules.
 */
import { randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 7;

/** URL-safe one-time code, ~128 bits of entropy. */
export function generateInviteCode(): string {
  return randomBytes(16).toString("base64url");
}

export function inviteExpiresAt(from: Date): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isInviteUsable(
  invite: { usedAt: Date | null; expiresAt: Date },
  now: Date,
): boolean {
  return invite.usedAt === null && invite.expiresAt.getTime() > now.getTime();
}
