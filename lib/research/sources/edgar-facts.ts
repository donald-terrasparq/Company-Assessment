/**
 * SEC EDGAR XBRL company facts — free, no key (data.sec.gov). Employee count
 * and revenue from filings harden size/fit for public companies. Private
 * companies simply return no facts.
 */
import { fetchJson } from "./util";

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerCache: TickerEntry[] | null = null;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,']/g, "")
    .replace(/\b(inc|corp|corporation|co|company|ltd|llc|plc|holdings?|group)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Pure: match a company name against the SEC ticker registry. */
export function matchCik(entries: TickerEntry[], companyName: string): number | null {
  const target = norm(companyName);
  if (!target) return null;
  const exact = entries.find((e) => norm(e.title) === target);
  if (exact) return exact.cik_str;
  const prefix = entries.find(
    (e) => norm(e.title).startsWith(target) || target.startsWith(norm(e.title)),
  );
  return prefix?.cik_str ?? null;
}

interface ConceptResponse {
  units?: Record<string, Array<{ end?: string; val?: number; form?: string; fy?: number }>>;
}

function latestValue(concept: ConceptResponse | null): { val: number; end: string } | null {
  if (!concept?.units) return null;
  const series = Object.values(concept.units)[0] ?? [];
  const latest = [...series]
    .filter((p) => typeof p.val === "number" && p.end)
    .sort((a, b) => (a.end! < b.end! ? 1 : -1))[0];
  return latest ? { val: latest.val!, end: latest.end! } : null;
}

export async function edgarFacts(companyName: string): Promise<string[]> {
  if (!tickerCache) {
    const raw = await fetchJson<Record<string, TickerEntry>>(
      "https://www.sec.gov/files/company_tickers.json",
    );
    if (!raw) return [];
    tickerCache = Object.values(raw);
  }
  const cik = matchCik(tickerCache, companyName);
  if (!cik) return []; // not SEC-registered → private company, no facts

  const cikPadded = String(cik).padStart(10, "0");
  const facts: string[] = [`SEC-registered public company (CIK ${cik}).`];

  const [employees, revenues, revenuesAlt] = await Promise.all([
    fetchJson<ConceptResponse>(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cikPadded}/dei/EntityNumberOfEmployees.json`,
    ),
    fetchJson<ConceptResponse>(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cikPadded}/us-gaap/Revenues.json`,
    ),
    fetchJson<ConceptResponse>(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cikPadded}/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax.json`,
    ),
  ]);

  const emp = latestValue(employees);
  if (emp) facts.push(`Employees (SEC filing, as of ${emp.end}): ${emp.val.toLocaleString()}`);
  const rev = latestValue(revenues) ?? latestValue(revenuesAlt);
  if (rev) {
    facts.push(
      `Revenue (SEC filing, period ending ${rev.end}): $${(rev.val / 1e6).toFixed(0)}M`,
    );
  }
  return facts;
}
