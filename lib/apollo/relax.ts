/**
 * Contact-search auto-relaxation (the Fertitta case: default IT-centric
 * filters can match nobody at some companies). When a search yields fewer
 * than MIN_CONTACT_TARGET matches, the ladder loosens filters step by step:
 *
 *   1. the requested filters as-is
 *   2. department filter removed
 *   3. title keywords removed too
 *   4+ seniority broadened downward (head → manager → senior → entry)
 *   last: every seniority, no department, no titles
 *
 * The step that finally produced contacts is reported so the Top Contacts
 * filter panel can update to reflect what's actually shown. Pure module.
 */
import { SENIORITY_OPTIONS, type ContactPrefs } from "./prefs";

export const MIN_CONTACT_TARGET = 2; // stop relaxing once ≥ this many match

const BROADEN_ORDER = ["head", "manager", "senior", "entry"];

export interface RelaxStep {
  prefs: ContactPrefs;
  note: string; // human-readable: what was loosened
}

const key = (p: ContactPrefs) =>
  `${[...p.seniorities].sort().join(",")}|${[...p.departments].sort().join(",")}|${[...p.titles].sort().join(",")}`;

/** The ordered attempts, deduped — first entry is always the request as-is. */
export function relaxationLadder(prefs: ContactPrefs): RelaxStep[] {
  const steps: RelaxStep[] = [{ prefs, note: "requested filters" }];

  const noDept: ContactPrefs = { ...prefs, departments: [] };
  steps.push({ prefs: noDept, note: "department filter removed" });

  const noTitles: ContactPrefs = { ...noDept, titles: [] };
  steps.push({ prefs: noTitles, note: "department and title filters removed" });

  let seniorities = [...prefs.seniorities];
  const addedSoFar: string[] = [];
  for (const level of BROADEN_ORDER) {
    if (seniorities.includes(level)) continue;
    seniorities = [...seniorities, level];
    addedSoFar.push(level);
    steps.push({
      prefs: { ...noTitles, seniorities: [...seniorities] },
      note: `seniority broadened (+${addedSoFar.join(", +")})`,
    });
  }

  steps.push({
    prefs: {
      seniorities: SENIORITY_OPTIONS.map((o) => o.value),
      departments: [],
      titles: [],
    },
    note: "all seniorities, no department or title filters",
  });

  // drop consecutive duplicates (e.g. prefs already had no departments)
  const seen = new Set<string>();
  return steps.filter((s) => {
    const k = key(s.prefs);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
