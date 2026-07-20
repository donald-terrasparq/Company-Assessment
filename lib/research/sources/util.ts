/** Shared fetch helpers for the free enrichment sources — every call is
 * bounded and failure-tolerant: a dead source never sinks a company. */

const TIMEOUT_MS = 8000;

export function ua(): string {
  return (
    process.env.SEC_USER_AGENT ??
    "CTS Mobility Company Assessment research (ops@ctsmobility.com)"
  );
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": ua(), Accept: "application/json", ...init?.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
