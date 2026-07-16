import { braveProvider } from "./brave";
import { googleCseProvider } from "./google_cse";
import { ANTHROPIC_PROVIDER_NAME, type SearchProvider } from "./provider";

/**
 * Resolve settings.search_provider to an implementation. 'anthropic' returns
 * null — extraction then uses the server-side web_search tool instead of
 * pre-fetched hits ($10 per 1,000 searches + tokens, docs/01-ARCHITECTURE.md).
 */
export function resolveSearchProvider(name: string): SearchProvider | null {
  switch (name) {
    case "brave":
      return braveProvider;
    case "google_cse":
      return googleCseProvider;
    case ANTHROPIC_PROVIDER_NAME:
      return null;
    default:
      throw new Error(`Unknown search provider: ${name}`);
  }
}
