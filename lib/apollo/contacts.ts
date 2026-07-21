/**
 * Apollo people search + on-demand enrichment (Phase 7).
 *
 * Search returns names/titles/LinkedIn URLs only — NO email, NO phone, and
 * costs no export credits. Email is revealed only when the user selects a
 * contact (people/match, 1 export credit). Phone is a second, explicit
 * option: Apollo delivers numbers asynchronously to a webhook, so the
 * request marks the contact pending and /api/apollo/webhook stores the
 * number when it arrives.
 */
import { apolloPost } from "./client";
import {
  companyBand,
  isAllowedContact,
  rankContacts,
  searchSeniorities,
  TARGET_TITLES,
} from "./targeting";

export interface ApolloCandidate {
  apolloPersonId: string;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
}

interface SearchResponse {
  people?: Array<{
    id: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    title?: string | null;
    linkedin_url?: string | null;
  }>;
}

export const MAX_APOLLO_CONTACTS = 5;

/** Find best contacts for a company — filtered by the seniority rules. */
export async function searchBestContacts(input: {
  domain: string;
  revenueUsd: number | null;
  employees: number | null;
}): Promise<ApolloCandidate[]> {
  const band = companyBand(input.revenueUsd, input.employees);
  const data = await apolloPost<SearchResponse>("/mixed_people/search", {
    q_organization_domains_list: [input.domain],
    person_seniorities: searchSeniorities(band),
    person_titles: TARGET_TITLES,
    contact_email_status: ["verified", "likely to engage"],
    page: 1,
    per_page: 25,
  });

  const candidates: ApolloCandidate[] = (data.people ?? [])
    .map((p) => ({
      apolloPersonId: p.id,
      name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" "),
      title: p.title ?? null,
      linkedinUrl: p.linkedin_url ?? null,
    }))
    .filter((p) => p.apolloPersonId && p.name)
    // the hard gate: no CEO ≥ $20M, no C-level > $500M — whatever search returned
    .filter((p) => isAllowedContact(p.title, input.revenueUsd, input.employees));

  return rankContacts(candidates).slice(0, MAX_APOLLO_CONTACTS);
}

interface MatchResponse {
  person?: {
    id?: string;
    email?: string | null;
    linkedin_url?: string | null;
    title?: string | null;
  };
}

/** Reveal the work email for one selected contact (1 Apollo export credit). */
export async function revealEmail(input: {
  apolloPersonId: string | null;
  name: string;
  domain: string;
}): Promise<string | null> {
  const body: Record<string, unknown> = {
    reveal_personal_emails: false, // work email only — never personal
  };
  if (input.apolloPersonId) body.id = input.apolloPersonId;
  else {
    body.name = input.name;
    body.domain = input.domain;
  }
  const data = await apolloPost<MatchResponse>("/people/match", body);
  const email = data.person?.email ?? null;
  return email && !email.includes("not_unlocked") ? email : null;
}

/**
 * Request the direct/mobile number for one selected contact. Apollo returns
 * numbers ASYNCHRONOUSLY: this call succeeds immediately and Apollo later
 * POSTs the number to webhookUrl (handled by /api/apollo/webhook).
 */
export async function requestPhone(input: {
  apolloPersonId: string | null;
  name: string;
  domain: string;
  webhookUrl: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    reveal_personal_emails: false,
    reveal_phone_number: true,
    webhook_url: input.webhookUrl,
  };
  if (input.apolloPersonId) body.id = input.apolloPersonId;
  else {
    body.name = input.name;
    body.domain = input.domain;
  }
  await apolloPost<MatchResponse>("/people/match", body);
}

/** Pull the best phone number out of Apollo's webhook payload. */
export function phoneFromWebhookPayload(payload: unknown): string | null {
  const people = (payload as { people?: Array<Record<string, unknown>> })?.people;
  const person = Array.isArray(people) ? people[0] : undefined;
  const numbers = person?.phone_numbers as
    | Array<{ sanitized_number?: string; raw_number?: string; type_cd?: string }>
    | undefined;
  if (!Array.isArray(numbers) || numbers.length === 0) return null;
  const mobile = numbers.find((n) => n.type_cd === "mobile");
  const pick = mobile ?? numbers[0];
  return pick.sanitized_number ?? pick.raw_number ?? null;
}
