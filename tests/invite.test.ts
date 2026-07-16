import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  inviteExpiresAt,
  isInviteUsable,
  INVITE_TTL_DAYS,
} from "@/lib/auth/invite";

describe("invite codes", () => {
  it("generates unique, URL-safe codes", () => {
    const a = generateInviteCode();
    const b = generateInviteCode();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(20);
  });

  it("expires exactly 7 days out", () => {
    const from = new Date("2026-07-16T12:00:00Z");
    const exp = inviteExpiresAt(from);
    expect(exp.getTime() - from.getTime()).toBe(INVITE_TTL_DAYS * 86_400_000);
  });

  it("is usable only when unused and unexpired", () => {
    const now = new Date("2026-07-16T12:00:00Z");
    const future = new Date("2026-07-20T12:00:00Z");
    const past = new Date("2026-07-10T12:00:00Z");
    expect(isInviteUsable({ usedAt: null, expiresAt: future }, now)).toBe(true);
    expect(isInviteUsable({ usedAt: past, expiresAt: future }, now)).toBe(false);
    expect(isInviteUsable({ usedAt: null, expiresAt: past }, now)).toBe(false);
    expect(isInviteUsable({ usedAt: null, expiresAt: now }, now)).toBe(false);
  });
});
