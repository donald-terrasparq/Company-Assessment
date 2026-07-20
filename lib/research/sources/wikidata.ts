/**
 * Wikidata — free, no key. HQ, employee count, official website, inception.
 * The official-website claim doubles as a typo check on uploaded domains
 * (the mcirocenter.com problem).
 */
import { fetchJson } from "./util";

interface SearchResponse {
  search?: Array<{ id: string; label?: string; description?: string }>;
}
interface EntityResponse {
  entities?: Record<
    string,
    {
      claims?: Record<
        string,
        Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>
      >;
    }
  >;
}

interface WikidataEntity {
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
}

function claimValue(entity: WikidataEntity, prop: string): unknown {
  return entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
}

/** Pure: extract the fact lines we care about from an entity's claims. */
export function extractWikidataFacts(entity: WikidataEntity): {
  facts: string[];
  officialWebsite: string | null;
} {
  const facts: string[] = [];
  let officialWebsite: string | null = null;

  const employees = claimValue(entity, "P1128") as { amount?: string } | undefined;
  if (employees?.amount) {
    const n = Number(employees.amount.replace("+", ""));
    if (Number.isFinite(n) && n > 0) facts.push(`Employees (Wikidata): ~${n.toLocaleString()}`);
  }
  const website = claimValue(entity, "P856");
  if (typeof website === "string" && website.startsWith("http")) {
    officialWebsite = website;
    facts.push(`Official website (Wikidata): ${website}`);
  }
  const inception = claimValue(entity, "P571") as { time?: string } | undefined;
  if (inception?.time) {
    const year = inception.time.match(/([+-]?\d{4})/)?.[1];
    if (year) facts.push(`Founded (Wikidata): ${Number(year)}`);
  }
  return { facts, officialWebsite };
}

export async function wikidataFacts(
  companyName: string,
): Promise<{ facts: string[]; officialWebsite: string | null }> {
  const empty = { facts: [], officialWebsite: null };
  const search = await fetchJson<SearchResponse>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(companyName)}&language=en&type=item&format=json&limit=3&origin=*`,
  );
  const hit =
    search?.search?.find((s) =>
      /(compan|corporat|retail|chain|business|enterprise|manufactur|bank|insur|health|hospital)/i.test(
        s.description ?? "",
      ),
    ) ?? search?.search?.[0];
  if (!hit) return empty;

  const data = await fetchJson<EntityResponse>(
    `https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`,
  );
  const entity = data?.entities?.[hit.id];
  if (!entity) return empty;
  return extractWikidataFacts(entity);
}
