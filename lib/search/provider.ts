/**
 * Pluggable search providers (docs/01-ARCHITECTURE.md). The engine composes
 * the configured provider with the always-on free SEC EDGAR provider.
 */

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  publishedDate: string | null; // YYYY-MM-DD when known
  source: string; // provider name
}

export interface SearchProvider {
  name: string;
  costPerSearchUsd: number;
  search(query: string, opts?: { limit?: number }): Promise<SearchHit[]>;
}

/**
 * The 'anthropic' setting means "no pre-fetch — the extraction call itself
 * uses Anthropic's server-side web_search tool" (docs/06-PROMPTS.md). gather()
 * checks this flag and skips searching entirely.
 */
export const ANTHROPIC_PROVIDER_NAME = "anthropic";
