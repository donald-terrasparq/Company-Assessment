/**
 * Apollo.io REST client (Phase 7). Server-side only — the key never reaches
 * the browser. Exactly two endpoints are used (scope the API key to these):
 *
 *   POST /api/v1/mixed_people/search   People Search — find best contacts
 *   POST /api/v1/people/match          People Enrichment — reveal email/phone
 *
 * No organization endpoints, no bulk endpoints, no CRM/sequence endpoints.
 */

const BASE = "https://api.apollo.io/api/v1";
const TIMEOUT_MS = 15_000;

export function isApolloConfigured(): boolean {
  return !!process.env.APOLLO_API_KEY;
}

export async function apolloPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY is not configured.");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
