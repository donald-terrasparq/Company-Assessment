import { auth } from "@/auth";
import {
  inviteFromAddress,
  isResendConfigured,
  resendKey,
  resendKeyFingerprint,
  resendKeySource,
} from "@/lib/email/invite";

/**
 * GET /api/resend/health — admin-only key check for the Users tab. Calls
 * Resend's domains endpoint (free, no email sent) and reports which env var
 * supplied the key plus a safe fingerprint. Also warns when no domain is
 * verified — the default onboarding@resend.dev sender only delivers to the
 * Resend account owner's own address.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Admin only." }, { status: 403 });
  }
  const from = inviteFromAddress();
  if (!isResendConfigured()) {
    return Response.json({
      ok: false,
      detail:
        "No key found — add RESEND_API_KEY (underscores, not dashes) to the Render WEB service environment and redeploy.",
      keySource: null,
      keyFingerprint: null,
      from,
    });
  }

  const keySource = resendKeySource();
  const keyFingerprint = resendKeyFingerprint();
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey()}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text().catch(() => "");

    // sending-only keys can't list domains but ARE valid for sending
    if (res.status === 401 && body.toLowerCase().includes("restricted")) {
      return Response.json({
        ok: true,
        detail: `Resend accepted the key (sending-only permissions). Sender in use: ${from}. If that's the default onboarding@resend.dev, Resend only delivers to the email you signed up with — verify a domain and set INVITE_FROM_EMAIL to reach anyone else.`,
        keySource,
        keyFingerprint,
        from,
      });
    }
    if (!res.ok) {
      return Response.json({
        ok: false,
        detail:
          res.status === 401
            ? `Resend returned 401 — the key VALUE is wrong. Re-paste it into RESEND_API_KEY. Resend said: ${body.slice(0, 160)}`
            : `Resend check failed (${res.status}): ${body.slice(0, 160)}`,
        keySource,
        keyFingerprint,
        from,
      });
    }

    const domains = (JSON.parse(body) as { data?: Array<{ name?: string; status?: string }> })
      .data ?? [];
    const verified = domains.filter((d) => d.status === "verified");
    const usingDefaultSender = from.includes("onboarding@resend.dev");
    const detail =
      verified.length > 0
        ? `Resend accepted the key. Verified domain${verified.length > 1 ? "s" : ""}: ${verified
            .map((d) => d.name)
            .join(", ")}. Sender in use: ${from}.${
            usingDefaultSender
              ? " You're still on the default onboarding@resend.dev sender — set INVITE_FROM_EMAIL to an address on your verified domain so invites reach everyone."
              : ""
          }`
        : `Resend accepted the key, but NO verified domain exists yet. With the default onboarding@resend.dev sender, Resend only delivers to the email address you signed up to Resend with — everyone else silently fails. Verify a domain in Resend (Domains tab), then set INVITE_FROM_EMAIL, e.g. "CTS Mobility <invites@yourdomain.com>".`;
    return Response.json({
      ok: verified.length > 0,
      detail,
      keySource,
      keyFingerprint,
      from,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      detail: `Could not reach api.resend.com: ${String(err).slice(0, 160)}`,
      keySource,
      keyFingerprint,
      from,
    });
  }
}
