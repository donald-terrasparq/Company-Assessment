/**
 * VIEW ALL / VIEW SELECTED combine rule: one row per company (keyed by
 * domain, falling back to case-insensitive name), best score wins, ranked
 * descending. Pure — no DB imports, unit-testable.
 */
export function dedupeBestByCompany<
  T extends { domain: string | null; companyName: string; totalScore: number },
>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const key = r.domain ?? r.companyName.trim().toLowerCase();
    const current = best.get(key);
    if (!current || r.totalScore > current.totalScore) best.set(key, r);
  }
  return [...best.values()].sort((a, b) => b.totalScore - a.totalScore);
}
