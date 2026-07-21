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

/** The Render env var is named APOLLO; APOLLO_API_KEY also works. */
export function apolloKey(): string | undefined {
  return process.env.APOLLO ?? process.env.APOLLO_API_KEY;
}

export function isApolloConfigured(): boolean {
  return !!apolloKey();
}

export async function apolloPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = apolloKey();
  if (!key) throw new Error("Apollo key is not configured (env var APOLLO).");
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
