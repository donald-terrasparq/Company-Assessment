/**
 * Apollo.io REST client (Phase 7). Server-side only — the key never reaches
 * the browser. Exactly four endpoints are used (scope the API key to these):
 *
 *   POST /api/v1/mixed_people/search     People Search — find best contacts
 *   POST /api/v1/people/match            People Enrichment — reveal email/phone
 *   GET  /api/v1/organizations/enrich    Organization Enrichment — firmographics
 *   POST /api/v1/news_articles/search    News — per-company event articles
 *
 * No bulk endpoints, no CRM/sequence/task endpoints.
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

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const key = apolloKey();
  if (!key) throw new Error("Apollo key is not configured (env var APOLLO).");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
      ...init.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function apolloPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function apolloGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  return request<T>(`${path}?${qs}`, { method: "GET" });
}
