import { describe, expect, it } from "vitest";
import { buildInviteEmail } from "@/lib/email/invite";

describe("buildInviteEmail", () => {
  const input = {
    firstName: "Jane",
    companyName: "CTS Mobility",
    inviteUrl: "https://app.example.com/register?code=abc123",
    invitedBy: "Donald T",
  };

  it("greets by first name, names the company and inviter, links the invite", () => {
    const { subject, html, text } = buildInviteEmail(input);
    expect(subject).toBe("You're invited to CTS Mobility Company Assessment");
    for (const body of [html, text]) {
      expect(body).toContain("Hi Jane,");
      expect(body).toContain("by Donald T");
      expect(body).toContain("https://app.example.com/register?code=abc123");
      expect(body).toContain("7 days");
    }
  });

  it("handles missing name and inviter gracefully", () => {
    const { text } = buildInviteEmail({ ...input, firstName: null, invitedBy: null });
    expect(text).toContain("Hi,");
    expect(text).not.toContain("by ");
  });
});
