import { phoneFromWebhookPayload } from "@/lib/apollo/contacts";
import { verifyWebhookToken } from "@/lib/apollo/webhook-token";
import { getContactById, setContactPhone } from "@/lib/db/queries/contacts";

/**
 * POST /api/apollo/webhook?cid=…&token=… — Apollo's asynchronous phone-number
 * delivery. Unauthenticated by necessity (Apollo calls it), so it is gated by
 * an HMAC token minted per contact when the phone was requested, and it can
 * only ever write the phone field of a contact with a request in flight.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cid = url.searchParams.get("cid") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!cid || !token || !verifyWebhookToken(cid, token)) {
    return Response.json({ error: "Invalid token." }, { status: 401 });
  }

  const contact = await getContactById(cid);
  if (!contact || !contact.phoneRequestedAt) {
    return Response.json({ error: "No phone request in flight." }, { status: 404 });
  }
  if (contact.phone) return Response.json({ ok: true }); // idempotent redelivery

  const payload = await request.json().catch(() => null);
  const phone = phoneFromWebhookPayload(payload);
  if (!phone) return Response.json({ ok: true, note: "no number in payload" });

  await setContactPhone(cid, phone);
  return Response.json({ ok: true });
}
