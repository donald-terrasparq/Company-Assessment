import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { contacts } from "../schema";
import type { ApolloCandidate } from "@/lib/apollo/contacts";

export async function getContactById(id: string) {
  const rows = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Store Apollo-found contacts for a result. Skips people already on the card
 * (case-insensitive name match) so re-running the search never duplicates,
 * and tags search-found duplicates with their apollo_person_id so they can
 * be enriched by exact id later.
 */
export async function addApolloContacts(
  companyResultId: string,
  candidates: ApolloCandidate[],
): Promise<number> {
  const existing = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyResultId, companyResultId));
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));

  let added = 0;
  for (const cand of candidates) {
    const match = byName.get(cand.name.trim().toLowerCase());
    if (match) {
      if (!match.apolloPersonId) {
        await db
          .update(contacts)
          .set({ apolloPersonId: cand.apolloPersonId, verified: true })
          .where(eq(contacts.id, match.id));
      }
      continue;
    }
    await db.insert(contacts).values({
      companyResultId,
      name: cand.name,
      title: cand.title,
      linkedinUrl: cand.linkedinUrl,
      source: "apollo",
      verified: true, // Apollo person records are directory-verified
      apolloPersonId: cand.apolloPersonId,
    });
    added++;
  }
  return added;
}

export async function setContactEmail(id: string, email: string): Promise<void> {
  await db
    .update(contacts)
    .set({ email, enrichedAt: new Date() })
    .where(eq(contacts.id, id));
}

export async function markPhoneRequested(id: string): Promise<void> {
  await db.update(contacts).set({ phoneRequestedAt: new Date() }).where(eq(contacts.id, id));
}

/** Webhook write: only fills a phone for a contact with a request in flight. */
export async function setContactPhone(id: string, phone: string): Promise<boolean> {
  const rows = await db
    .update(contacts)
    .set({ phone, enrichedAt: new Date() })
    .where(and(eq(contacts.id, id)))
    .returning({ id: contacts.id });
  return rows.length > 0;
}
