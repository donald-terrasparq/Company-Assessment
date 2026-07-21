/**
 * Signs the Apollo phone-webhook URL so only Apollo's callback for a contact
 * we actually requested can write to the DB. HMAC over the contact id with
 * AUTH_SECRET — no extra env var to configure.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function webhookToken(contactId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`apollo-phone:${contactId}`).digest("hex");
}

export function verifyWebhookToken(contactId: string, token: string): boolean {
  try {
    const expected = webhookToken(contactId);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(token, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
