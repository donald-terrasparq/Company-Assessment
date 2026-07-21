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
  const byApolloId = new Map(
    existing.filter((c) => c.apolloPersonId).map((c) => [c.apolloPersonId as string, c]),
  );
  // a first-name-only row matches its own fuller candidate ("Steven" ~ "Steven Doyle")
  const wordCount = (n: string) => n.trim().split(/\s+/).length;

  let added = 0;
  for (const cand of candidates) {
    const match =
      byApolloId.get(cand.apolloPersonId) ??
      byName.get(cand.name.trim().toLowerCase()) ??
      existing.find(
        (c) =>
          wordCount(c.name) === 1 &&
          cand.name.toLowerCase().startsWith(`${c.name.trim().toLowerCase()} `),
      );
    if (match) {
      const patch: Record<string, unknown> = {};
      if (!match.apolloPersonId) {
        patch.apolloPersonId = cand.apolloPersonId;
        patch.verified = true;
      }
      // upgrade stored first-name-only rows to the full name
      if (wordCount(cand.name) > wordCount(match.name)) patch.name = cand.name;
      if (!match.title && cand.title) patch.title = cand.title;
      if (Object.keys(patch).length > 0) {
        await db.update(contacts).set(patch).where(eq(contacts.id, match.id));
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

/**
 * Filtered re-search (the card's quick filters): REPLACE the Apollo contacts
 * on display with the new result set. Enriched rows (revealed email/phone or
 * a phone request in flight) are kept — that data cost credits — as are
 * research-found ('search') contacts.
 */
export async function replaceApolloContacts(
  companyResultId: string,
  candidates: ApolloCandidate[],
): Promise<number> {
  const existing = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyResultId, companyResultId));
  const removable = existing.filter(
    (c) => c.source === "apollo" && !c.email && !c.phone && !c.phoneRequestedAt,
  );
  for (const c of removable) {
    await db.delete(contacts).where(eq(contacts.id, c.id));
  }
  return addApolloContacts(companyResultId, candidates);
}

/** How many Apollo-sourced contacts a result already shows — load-more's offset. */
export async function countApolloContacts(companyResultId: string): Promise<number> {
  const rows = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.companyResultId, companyResultId), eq(contacts.source, "apollo")));
  return rows.length;
}

export async function setContactEmail(id: string, email: string): Promise<void> {
  await db
    .update(contacts)
    .set({ email, enrichedAt: new Date() })
    .where(eq(contacts.id, id));
}

/** Enrichment responses carry the complete name — upgrade partial rows. */
export async function setContactName(id: string, name: string): Promise<void> {
  await db.update(contacts).set({ name }).where(eq(contacts.id, id));
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
