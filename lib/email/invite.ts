/**
 * Invite emails via Resend or Brevo — the admin picks the provider in
 * Settings → Users (stored in settings.email_provider). Server-side only;
 * keys never reach the browser.
 *
 * - Resend: RESEND_API_KEY. The default onboarding@resend.dev sender only
 *   delivers to the Resend account owner's own address until a domain is
 *   verified and INVITE_FROM_EMAIL is set (a Resend rule, not ours).
 * - Brevo:  BREVO_API_KEY (or BREVO). Brevo has no default sender —
 *   INVITE_FROM_EMAIL is REQUIRED and must be a sender validated in Brevo
 *   (Senders, Domains & Dedicated IPs), but an individual address like a
 *   gmail can be validated without owning a domain.
 */

export type EmailProvider = "resend" | "brevo";

export const EMAIL_PROVIDERS: EmailProvider[] = ["resend", "brevo"];

export const EMAIL_PROVIDER_LABEL: Record<EmailProvider, string> = {
  resend: "Resend",
  brevo: "Brevo",
};

function cleanEnv(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^["']+|["']+$/g, "");
  return cleaned || undefined;
}

export function resendKey(): string | undefined {
  return cleanEnv(process.env.RESEND_API_KEY ?? process.env["RESEND-API_KEY"]);
}

export function brevoKey(): string | undefined {
  return cleanEnv(process.env.BREVO_API_KEY ?? process.env.BREVO);
}

export function emailProviderKey(provider: EmailProvider): string | undefined {
  return provider === "brevo" ? brevoKey() : resendKey();
}

export function isEmailProviderConfigured(provider: EmailProvider): boolean {
  return !!emailProviderKey(provider);
}

/** Which env var supplied the key — spotting a dash/short-named var. */
export function emailProviderKeySource(provider: EmailProvider): string | null {
  if (provider === "brevo") {
    if (cleanEnv(process.env.BREVO_API_KEY)) return "BREVO_API_KEY";
    if (cleanEnv(process.env.BREVO)) return "BREVO";
    return null;
  }
  if (cleanEnv(process.env.RESEND_API_KEY)) return "RESEND_API_KEY";
  if (cleanEnv(process.env["RESEND-API_KEY"])) return "RESEND-API_KEY";
  return null;
}

/** Safe fingerprint (first/last 4 chars) so a bad paste can be spotted. */
export function emailProviderKeyFingerprint(provider: EmailProvider): string | null {
  const key = emailProviderKey(provider);
  if (!key) return null;
  if (key.length <= 8) return `${key.slice(0, 2)}…`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** The configured sender, if any. Resend falls back to its onboarding sender. */
export function inviteFromAddress(provider: EmailProvider): string | null {
  const configured = process.env.INVITE_FROM_EMAIL?.trim();
  if (configured) return configured;
  return provider === "resend" ? "Company Assessment <onboarding@resend.dev>" : null;
}

/** Pure: split "Name <a@b.c>" (or a bare address) into Brevo's sender shape. */
export function parseSenderAddress(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (match) {
    const name = match[1].replace(/^["']+|["']+$/g, "").trim();
    return name ? { name, email: match[2] } : { email: match[2] };
  }
  return { email: from.trim() };
}

export interface InviteEmailInput {
  firstName: string | null;
  companyName: string;
  inviteUrl: string;
  invitedBy: string | null;
}

/** Pure builder — unit-testable. */
export function buildInviteEmail(input: InviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const by = input.invitedBy ? ` by ${input.invitedBy}` : "";
  const subject = `You're invited to ${input.companyName} Company Assessment`;
  const text = `${greeting}

You've been invited${by} to ${input.companyName}'s Company Assessment — the prospect
signal-intelligence tool. Create your account with this one-time link (valid 7 days):

${input.inviteUrl}

If you weren't expecting this, you can ignore this email.`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#17222f">
  <h2 style="margin:0 0 12px;font-size:19px">${input.companyName} · Company Assessment</h2>
  <p style="font-size:14px;line-height:1.55;margin:0 0 10px">${greeting}</p>
  <p style="font-size:14px;line-height:1.55;margin:0 0 18px">
    You've been invited${by} to <b>${input.companyName}</b>'s Company Assessment —
    the prospect signal-intelligence tool. Create your account with this one-time
    link (valid for 7 days):
  </p>
  <p style="margin:0 0 18px">
    <a href="${input.inviteUrl}"
       style="display:inline-block;background:#17222f;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">
      Create your account
    </a>
  </p>
  <p style="font-size:12px;color:#697386;line-height:1.5;margin:0">
    Or paste this link into your browser:<br/>
    <a href="${input.inviteUrl}" style="color:#1F7AC8">${input.inviteUrl}</a><br/><br/>
    If you weren't expecting this, you can ignore this email.
  </p>
</div>`;
  return { subject, html, text };
}

/**
 * Pure: turn a raw send-failure message into an actionable hint for the
 * Users tab. Returns null when we have nothing better than the raw error.
 */
export function inviteEmailFailureHint(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("resend_api_key is not configured")) {
    return "Set RESEND_API_KEY on the Render web service (Environment tab), then redeploy — or switch the provider to Brevo below.";
  }
  if (m.includes("brevo_api_key is not configured")) {
    return "Set BREVO_API_KEY on the Render web service (Environment tab) — create the key in Brevo under SMTP & API → API Keys — then redeploy.";
  }
  if (m.includes("invite_from_email is not set")) {
    return "Brevo has no default sender. Validate a sender address in Brevo (Senders, Domains & Dedicated IPs → Senders), then set INVITE_FROM_EMAIL on the Render web service to that exact address, e.g. \"CTS Mobility <you@yourdomain.com>\".";
  }
  if (m.includes("resend 401")) {
    return "Resend rejected the key itself — re-paste the API key into RESEND_API_KEY on the Render web service (the value, not the key name).";
  }
  if (m.includes("brevo 401")) {
    return "Brevo rejected the key itself — re-paste the v3 API key (starts with xkeysib-) into BREVO_API_KEY on the Render web service.";
  }
  if (m.includes("brevo 402")) {
    return "Brevo says the account is out of email credits — check your Brevo plan.";
  }
  if (m.includes("brevo") && m.includes("sender")) {
    return "Brevo only sends from validated senders. In Brevo go to Senders, Domains & Dedicated IPs → Senders, add and confirm the address, and make sure INVITE_FROM_EMAIL matches it exactly.";
  }
  if (
    m.includes("testing emails") ||
    m.includes("verify a domain") ||
    m.includes("your own email address") ||
    (m.includes("resend 403") && m.includes("domain"))
  ) {
    return "Resend's default onboarding@resend.dev sender only delivers to the email address you signed up to Resend with. Verify your own domain in Resend (Domains tab), then set INVITE_FROM_EMAIL to e.g. \"CTS Mobility <invites@yourdomain.com>\" — or switch the provider to Brevo below.";
  }
  if (m.includes("resend 422")) {
    return "Resend rejected the message — usually a malformed from/to address. Check INVITE_FROM_EMAIL is either unset or a full address like \"Name <invites@yourdomain.com>\".";
  }
  if (m.includes("resend 429") || m.includes("brevo 429")) {
    return "Rate limit — wait a minute and press Email again.";
  }
  if (m.includes("abort") || m.includes("timeout") || m.includes("fetch failed")) {
    return "Could not reach the email provider from the server — likely transient; press Email again.";
  }
  return null;
}

/** Send via the chosen provider's REST API. Throws with its message on failure. */
export async function sendInviteEmail(
  input: InviteEmailInput & { to: string; provider: EmailProvider },
): Promise<void> {
  const key = emailProviderKey(input.provider);
  if (!key) {
    throw new Error(
      input.provider === "brevo"
        ? "BREVO_API_KEY is not configured."
        : "RESEND_API_KEY is not configured.",
    );
  }
  const from = inviteFromAddress(input.provider);
  if (!from) {
    throw new Error("INVITE_FROM_EMAIL is not set — Brevo requires a validated sender.");
  }
  const { subject, html, text } = buildInviteEmail(input);

  if (input.provider === "brevo") {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "api-key": key,
      },
      body: JSON.stringify({
        sender: parseSenderAddress(from),
        to: [{ email: input.to, ...(input.firstName ? { name: input.firstName } : {}) }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Brevo ${res.status}: ${body.slice(0, 200)}`);
    }
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ from, to: [input.to], subject, html, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}
