import { z } from "zod";
import { auth } from "@/auth";
import { isApolloConfigured } from "@/lib/apollo/client";
import { requestPhone, revealEmail } from "@/lib/apollo/contacts";
import { webhookToken } from "@/lib/apollo/webhook-token";
import {
  getContactById,
  markPhoneRequested,
  setContactEmail,
} from "@/lib/db/queries/contacts";
import { getResultDetail } from "@/lib/db/queries/prospects";
import { getSettings } from "@/lib/db/queries/settings";
import { logUsage } from "@/lib/db/queries/usage";

const BodySchema = z.object({
  contact_id: z.string().uuid(),
  reveal: z.enum(["email", "phone"]),
});

/** The app's public origin, for Apollo's async phone callback. */
function publicOrigin(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return `${proto}://${host}`;
}

/**
 * POST /api/apollo/enrich — reveal email or request a phone number for ONE
 * selected contact. Nothing is bulk-enriched: each reveal is an explicit
 * user action so credits are only spent on contacts someone actually chose.
 * Phone numbers arrive asynchronously via /api/apollo/webhook.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Not signed in." }, { status: 401 });

  const settings = await getSettings();
  if (!settings?.apolloEnabled) {
    return Response.json({ error: "Apollo is disabled in Settings → Data sources." }, { status: 403 });
  }
  if (!isApolloConfigured()) {
    return Response.json({ error: "Apollo key is not configured — set the APOLLO env var in Render." }, { status: 503 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "contact_id and reveal required." }, { status: 400 });

  const contact = await getContactById(parsed.data.contact_id);
  if (!contact) return Response.json({ error: "Contact not found." }, { status: 404 });
  const detail = await getResultDetail(contact.companyResultId);
  if (!detail?.company.domain) {
    return Response.json({ error: "No company domain on file for this contact." }, { status: 422 });
  }

  try {
    if (parsed.data.reveal === "email") {
      if (contact.email) return Response.json({ email: contact.email }); // already revealed
      const email = await revealEmail({
        apolloPersonId: contact.apolloPersonId,
        name: contact.name,
        domain: detail.company.domain,
      });
      if (!email) {
        return Response.json({ error: "Apollo has no verified email for this person." }, { status: 404 });
      }
      await setContactEmail(contact.id, email);
      await logUsage({
        runId: detail.result.runId,
        companyId: detail.company.id,
        provider: "apollo",
        searches: 1,
        costUsd: 0, // 1 Apollo export credit (plan allowance, not USD)
      });
      return Response.json({ email });
    }

    // phone — async: Apollo calls our webhook with the number
    if (contact.phone) return Response.json({ phone: contact.phone });
    const origin = publicOrigin(request);
    await requestPhone({
      apolloPersonId: contact.apolloPersonId,
      name: contact.name,
      domain: detail.company.domain,
      webhookUrl: `${origin}/api/apollo/webhook?cid=${contact.id}&token=${webhookToken(contact.id)}`,
    });
    await markPhoneRequested(contact.id);
    await logUsage({
      runId: detail.result.runId,
      companyId: detail.company.id,
      provider: "apollo",
      searches: 1,
      costUsd: 0, // consumes an Apollo mobile credit when delivered
    });
    return Response.json({ status: "requested" });
  } catch (err) {
    console.error("apollo enrich:", err);
    return Response.json({ error: "Apollo enrichment failed — try again shortly." }, { status: 502 });
  }
}
