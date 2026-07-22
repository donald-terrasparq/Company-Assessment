/**
 * Invite emails via Resend. Server-side only; the key never reaches the
 * browser. Configure RESEND_API_KEY on the Render web service. Optional
 * INVITE_FROM_EMAIL sets the sender once a domain is verified in Resend —
 * until then the default onboarding sender only delivers to the Resend
 * account owner's own address (a Resend rule, not ours).
 */

export function resendKey(): string | undefined {
  const raw = process.env.RESEND_API_KEY ?? process.env["RESEND-API_KEY"];
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^["']+|["']+$/g, "");
  return cleaned || undefined;
}

export function isResendConfigured(): boolean {
  return !!resendKey();
}

/** Which env var supplied the key — spotting a dash-named var ("RESEND-API_KEY"). */
export function resendKeySource(): string | null {
  if (process.env.RESEND_API_KEY?.trim()) return "RESEND_API_KEY";
  if (process.env["RESEND-API_KEY"]?.trim()) return "RESEND-API_KEY";
  return null;
}

/** Safe fingerprint (first/last 4 chars) so a bad paste can be spotted. */
export function resendKeyFingerprint(): string | null {
  const key = resendKey();
  if (!key) return null;
  if (key.length <= 8) return `${key.slice(0, 2)}…`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** The sender the next email will use — default until INVITE_FROM_EMAIL is set. */
export function inviteFromAddress(): string {
  return (
    process.env.INVITE_FROM_EMAIL?.trim() || "Company Assessment <onboarding@resend.dev>"
  );
}

/**
 * Pure: turn a raw Resend failure message into an actionable hint for the
 * Users tab. Returns null when we have nothing better than the raw error.
 */
export function inviteEmailFailureHint(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("resend_api_key is not configured")) {
    return "Set RESEND_API_KEY on the Render web service (Environment tab), then redeploy.";
  }
  if (m.includes("resend 401")) {
    return "Resend rejected the key itself — re-paste the API key into RESEND_API_KEY on the Render web service (the value, not the key name).";
  }
  if (
    m.includes("testing emails") ||
    m.includes("verify a domain") ||
    m.includes("your own email address") ||
    (m.includes("resend 403") && m.includes("domain"))
  ) {
    return "Resend's default onboarding@resend.dev sender only delivers to the email address you signed up to Resend with. Verify your own domain in Resend (Domains tab), then set INVITE_FROM_EMAIL to e.g. \"CTS Mobility <invites@yourdomain.com>\".";
  }
  if (m.includes("resend 422")) {
    return "Resend rejected the message — usually a malformed from/to address. Check INVITE_FROM_EMAIL is either unset or a full address like \"Name <invites@yourdomain.com>\".";
  }
  if (m.includes("resend 429")) {
    return "Resend rate limit — wait a minute and press Email again.";
  }
  if (m.includes("abort") || m.includes("timeout") || m.includes("fetch failed")) {
    return "Could not reach api.resend.com from the server — likely transient; press Email again.";
  }
  return null;
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

/** Send via Resend's REST API. Throws with Resend's message on failure. */
export async function sendInviteEmail(input: InviteEmailInput & { to: string }): Promise<void> {
  const key = resendKey();
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  const from =
    process.env.INVITE_FROM_EMAIL?.trim() ||
    "Company Assessment <onboarding@resend.dev>";
  const { subject, html, text } = buildInviteEmail(input);
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
