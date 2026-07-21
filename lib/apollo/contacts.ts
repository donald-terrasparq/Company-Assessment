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
import { buildSearchFilters, DEFAULT_CONTACT_PREFS, type ContactPrefs } from "./prefs";
import { MIN_CONTACT_TARGET, relaxationLadder } from "./relax";
import { companyBand, isAllowedContact, rankContacts } from "./targeting";

export interface ApolloCandidate {
  apolloPersonId: string;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
}

interface SearchPerson {
  id: string;
  person_id?: string; // present on CRM-contact records — the enrichable id
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string | null;
  linkedin_url?: string | null;
}

interface SearchResponse {
  people?: SearchPerson[]; // net-new directory people
  contacts?: SearchPerson[]; // records already saved in the Apollo workspace
}

export const MAX_APOLLO_CONTACTS = 5; // page size shown per fetch

export interface ContactSearchResult {
  candidates: ApolloCandidate[];
  totalMatching: number; // after the seniority gate — drives "load more"
}

/**
 * Find best contacts for a company. Filters come from the admin defaults
 * (Settings → Contacts) or a per-search override; the revenue-band gate is
 * applied both to the search and again to whatever comes back.
 */
export async function searchBestContacts(input: {
  domain: string;
  revenueUsd: number | null;
  employees: number | null;
  prefs?: ContactPrefs;
  /** paging window over the ranked matches — "load more" advances this */
  offset?: number;
  limit?: number;
}): Promise<ContactSearchResult> {
  const band = companyBand(input.revenueUsd, input.employees);
  const filters = buildSearchFilters(input.prefs ?? DEFAULT_CONTACT_PREFS, band);
  const body: Record<string, unknown> = {
    // api_search accepts exactly ONE domain param — sending the legacy
    // q_organization_domains alongside this one is a 422
    q_organization_domains_list: [input.domain],
    person_seniorities: filters.seniorities,
    page: 1,
    per_page: 100, // one big page; we rank and window locally
  };
  if (filters.titles.length > 0) body.person_titles = filters.titles;
  if (filters.apolloDepartments.length > 0) {
    body.person_department_or_subdepartments = filters.apolloDepartments;
  }
  const data = await apolloPost<SearchResponse>("/mixed_people/api_search", body);

  const candidates: ApolloCandidate[] = [...(data.people ?? []), ...(data.contacts ?? [])]
    .map((p) => {
      // api_search's `name` can carry the first name only — prefer the split
      // fields, and graft last_name on when `name` lacks it
      const joined = [p.first_name, p.last_name].filter(Boolean).join(" ");
      let name = joined || p.name || "";
      if (p.name && p.name.split(/\s+/).length > name.split(/\s+/).length) name = p.name;
      return {
        apolloPersonId: p.person_id ?? p.id,
        name,
        title: p.title ?? null,
        linkedinUrl: p.linkedin_url ?? null,
      };
    })
    .filter((p) => p.apolloPersonId && p.name)
    // the hard gate: no CEO ≥ $20M, no C-level > $500M — whatever search returned
    .filter((p) => isAllowedContact(p.title, input.revenueUsd, input.employees));

  const ranked = rankContacts(candidates);
  const offset = Math.max(0, input.offset ?? 0);
  const limit = input.limit ?? MAX_APOLLO_CONTACTS;
  return {
    candidates: ranked.slice(offset, offset + limit),
    totalMatching: ranked.length,
  };
}

export interface RelaxedSearchResult extends ContactSearchResult {
  appliedPrefs: ContactPrefs;
  relaxed: boolean;
  relaxNote: string | null;
}

/**
 * Search with AUTO-RELAXATION: when the filters match fewer than
 * MIN_CONTACT_TARGET people, loosen step by step (department → titles →
 * lower seniorities) until at least 2-4 contacts surface. Returns whichever
 * filters actually produced the result so the UI can reflect them.
 */
export async function searchBestContactsRelaxed(input: {
  domain: string;
  revenueUsd: number | null;
  employees: number | null;
  prefs?: ContactPrefs;
  limit?: number;
}): Promise<RelaxedSearchResult> {
  const ladder = relaxationLadder(input.prefs ?? DEFAULT_CONTACT_PREFS);
  let best: RelaxedSearchResult | null = null;
  for (let i = 0; i < ladder.length; i++) {
    const step = ladder[i];
    const res = await searchBestContacts({ ...input, prefs: step.prefs, offset: 0 });
    const wrapped: RelaxedSearchResult = {
      ...res,
      appliedPrefs: step.prefs,
      relaxed: i > 0,
      relaxNote: i > 0 ? step.note : null,
    };
    if (res.totalMatching >= MIN_CONTACT_TARGET) return wrapped;
    if (!best || res.totalMatching > best.totalMatching) best = wrapped;
  }
  return best!; // ladder always has ≥1 step
}

interface MatchResponse {
  person?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    linkedin_url?: string | null;
    title?: string | null;
  };
}

/**
 * Reveal the work email for one selected contact (1 Apollo export credit).
 * Also returns the person's full name — enrichment responses carry the
 * complete name even when search results were first-name-only.
 */
export async function revealEmail(input: {
  apolloPersonId: string | null;
  name: string;
  domain: string;
}): Promise<{ email: string | null; fullName: string | null }> {
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
  const joined = [data.person?.first_name, data.person?.last_name].filter(Boolean).join(" ");
  const fullName = joined || data.person?.name || null;
  return { email: email && !email.includes("not_unlocked") ? email : null, fullName };
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
