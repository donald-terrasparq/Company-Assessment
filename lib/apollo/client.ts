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

/** Carries Apollo's HTTP status + response body so routes can explain failures. */
export class ApolloError extends Error {
  constructor(
    public readonly status: number, // 0 = network/timeout, never reached Apollo
    public readonly body: string,
    path: string,
  ) {
    super(`Apollo ${path} failed (${status}): ${body.slice(0, 200)}`);
    this.name = "ApolloError";
  }
}

/**
 * A user-actionable message for an Apollo failure — shown in the UI banner so
 * "search failed" actually says what to fix. Pure; unit-tested.
 */
export function apolloErrorMessage(err: unknown): string {
  if (!(err instanceof ApolloError)) {
    return "Apollo call failed — try again shortly.";
  }
  const detail = err.body.replace(/\s+/g, " ").slice(0, 160).trim();
  switch (err.status) {
    case 0:
      return "Could not reach api.apollo.io — network issue or timeout. Try again shortly.";
    case 401:
      return "Apollo rejected the API key (401). Re-check the APOLLO env var value in Render — no quotes or spaces.";
    case 403:
      return `Apollo denied access (403) — the API key is not allowed to use this endpoint. In Apollo (Settings → Integrations → API), edit the key and enable it, or use a master key. Apollo said: ${detail || "forbidden"}`;
    case 422:
      return `Apollo rejected the request (422): ${detail || "invalid parameters"}`;
    case 429:
      return "Apollo rate limit reached (429) — wait a minute and try again.";
    default:
      return `Apollo error (${err.status}): ${detail || "no details"}`;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const key = apolloKey();
  if (!key) throw new Error("Apollo key is not configured (env var APOLLO).");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": key,
        ...init.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApolloError(0, err instanceof Error ? err.message : String(err), path);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApolloError(res.status, text, path);
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
