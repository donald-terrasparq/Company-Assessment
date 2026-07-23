import { auth } from "@/auth";
import { getSettings } from "@/lib/db/queries/settings";
import {
  EMAIL_PROVIDER_LABEL,
  emailProviderKey,
  emailProviderKeyFingerprint,
  emailProviderKeySource,
  inviteFromAddress,
  isEmailProviderConfigured,
} from "@/lib/email/invite";
import type { EmailProvider } from "@/lib/email/invite";

/**
 * GET /api/email/health — admin-only check of the ACTIVE invite-email
 * provider (settings.email_provider). No email is sent: Resend is probed via
 * its domains endpoint, Brevo via its account endpoint. Reports which env var
 * supplied the key plus a safe fingerprint, and flags the sender problems
 * that cause silent non-delivery.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Admin only." }, { status: 403 });
  }
  const settings = await getSettings();
  const provider: EmailProvider = settings?.emailProvider ?? "resend";
  const label = EMAIL_PROVIDER_LABEL[provider];
  const from = inviteFromAddress(provider);
  const base = {
    provider,
    keySource: emailProviderKeySource(provider),
    keyFingerprint: emailProviderKeyFingerprint(provider),
    from,
  };

  if (!isEmailProviderConfigured(provider)) {
    return Response.json({
      ...base,
      ok: false,
      detail:
        provider === "brevo"
          ? "No key found — create a v3 API key in Brevo (SMTP & API → API Keys) and add it as BREVO_API_KEY on the Render WEB service, then redeploy."
          : "No key found — add RESEND_API_KEY (underscores, not dashes) to the Render WEB service environment and redeploy.",
    });
  }

  try {
    if (provider === "brevo") {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { accept: "application/json", "api-key": emailProviderKey("brevo")! },
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.text().catch(() => "");
      if (!res.ok) {
        return Response.json({
          ...base,
          ok: false,
          detail:
            res.status === 401
              ? `Brevo returned 401 — the key VALUE is wrong (a v3 key starts with xkeysib-). Re-paste it into BREVO_API_KEY. Brevo said: ${body.slice(0, 160)}`
              : `Brevo check failed (${res.status}): ${body.slice(0, 160)}`,
        });
      }
      const account = JSON.parse(body) as { email?: string; companyName?: string };
      if (!from) {
        return Response.json({
          ...base,
          ok: false,
          detail: `Brevo accepted the key (account: ${account.email ?? "unknown"}), but INVITE_FROM_EMAIL is not set — Brevo has no default sender, so invites cannot go out. Validate a sender in Brevo (Senders, Domains & Dedicated IPs → Senders), then set INVITE_FROM_EMAIL to that exact address, e.g. "CTS Mobility <you@yourdomain.com>".`,
        });
      }
      return Response.json({
        ...base,
        ok: true,
        detail: `Brevo accepted the key (account: ${account.email ?? "unknown"}). Sender in use: ${from} — this address must be a VALIDATED sender in Brevo (Senders, Domains & Dedicated IPs), or every send fails.`,
      });
    }

    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${emailProviderKey("resend")}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text().catch(() => "");
    if (res.status === 401 && body.toLowerCase().includes("restricted")) {
      return Response.json({
        ...base,
        ok: true,
        detail: `Resend accepted the key (sending-only permissions). Sender in use: ${from}. If that's the default onboarding@resend.dev, Resend only delivers to the email you signed up with — verify a domain and set INVITE_FROM_EMAIL to reach anyone else.`,
      });
    }
    if (!res.ok) {
      return Response.json({
        ...base,
        ok: false,
        detail:
          res.status === 401
            ? `Resend returned 401 — the key VALUE is wrong. Re-paste it into RESEND_API_KEY. Resend said: ${body.slice(0, 160)}`
            : `Resend check failed (${res.status}): ${body.slice(0, 160)}`,
      });
    }
    const domains =
      (JSON.parse(body) as { data?: Array<{ name?: string; status?: string }> }).data ?? [];
    const verified = domains.filter((d) => d.status === "verified");
    const usingDefaultSender = (from ?? "").includes("onboarding@resend.dev");
    const detail =
      verified.length > 0
        ? `Resend accepted the key. Verified domain${verified.length > 1 ? "s" : ""}: ${verified
            .map((d) => d.name)
            .join(", ")}. Sender in use: ${from}.${
            usingDefaultSender
              ? " You're still on the default onboarding@resend.dev sender — set INVITE_FROM_EMAIL to an address on your verified domain so invites reach everyone."
              : ""
          }`
        : `Resend accepted the key, but NO verified domain exists yet. With the default onboarding@resend.dev sender, Resend only delivers to the email address you signed up to Resend with — everyone else silently fails. Verify a domain in Resend, set INVITE_FROM_EMAIL — or switch the provider to Brevo, which can validate an individual sender address without a domain.`;
    return Response.json({ ...base, ok: verified.length > 0, detail });
  } catch (err) {
    return Response.json({
      ...base,
      ok: false,
      detail: `Could not reach the ${label} API: ${String(err).slice(0, 160)}`,
    });
  }
}
