import { describe, expect, it } from "vitest";
import {
  buildInviteEmail,
  inviteEmailFailureHint,
  parseSenderAddress,
} from "@/lib/email/invite";

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

describe("inviteEmailFailureHint", () => {
  it("maps a bad key to a re-paste hint", () => {
    expect(inviteEmailFailureHint('Resend 401: {"message":"API key is invalid"}')).toContain(
      "RESEND_API_KEY",
    );
  });

  it("maps the onboarding-sender restriction to the verify-domain hint", () => {
    const hint = inviteEmailFailureHint(
      'Resend 403: {"message":"You can only send testing emails to your own email address (you@example.com). To send emails to other recipients, please verify a domain"}',
    );
    expect(hint).toContain("onboarding@resend.dev");
    expect(hint).toContain("INVITE_FROM_EMAIL");
  });

  it("maps a missing key to the env-var hint", () => {
    expect(inviteEmailFailureHint("RESEND_API_KEY is not configured.")).toContain(
      "Render web service",
    );
  });

  it("maps a malformed sender to the from-address hint", () => {
    expect(inviteEmailFailureHint('Resend 422: {"message":"Invalid `from` field"}')).toContain(
      "INVITE_FROM_EMAIL",
    );
  });

  it("returns null for unknown errors", () => {
    expect(inviteEmailFailureHint("Resend 500: internal error")).toBeNull();
  });

  it("maps a bad Brevo key to a re-paste hint", () => {
    expect(inviteEmailFailureHint('Brevo 401: {"message":"Key not found"}')).toContain(
      "BREVO_API_KEY",
    );
  });

  it("maps a missing Brevo key to the env-var hint", () => {
    expect(inviteEmailFailureHint("BREVO_API_KEY is not configured.")).toContain(
      "SMTP & API",
    );
  });

  it("maps a missing sender to the INVITE_FROM_EMAIL hint", () => {
    const hint = inviteEmailFailureHint(
      "INVITE_FROM_EMAIL is not set — Brevo requires a validated sender.",
    );
    expect(hint).toContain("Validate a sender");
    expect(hint).toContain("INVITE_FROM_EMAIL");
  });

  it("maps an unvalidated Brevo sender to the validate-sender hint", () => {
    expect(
      inviteEmailFailureHint('Brevo 400: {"code":"invalid_parameter","message":"sender email is not valid"}'),
    ).toContain("validated senders");
  });
});

describe("parseSenderAddress", () => {
  it("splits a display-name sender into name + email", () => {
    expect(parseSenderAddress("CTS Mobility <invites@ctsmobility.com>")).toEqual({
      name: "CTS Mobility",
      email: "invites@ctsmobility.com",
    });
  });

  it("handles a bare address", () => {
    expect(parseSenderAddress("donald98072@gmail.com")).toEqual({
      email: "donald98072@gmail.com",
    });
  });

  it("strips quotes around the display name", () => {
    expect(parseSenderAddress('"CTS Mobility" <invites@ctsmobility.com>')).toEqual({
      name: "CTS Mobility",
      email: "invites@ctsmobility.com",
    });
  });
});
