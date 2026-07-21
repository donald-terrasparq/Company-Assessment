/**
 * Apollo contact-search preferences (Settings → Contacts). Admin-set defaults
 * drive the automatic per-run search AND pre-fill the quick filters on the
 * Top Contacts card; users can override per search. The revenue-band gate
 * (no CEO ≥ $20M, no C-level > $500M) still overlays whatever is chosen.
 */
import { type CompanyBand } from "./targeting";

export interface ContactPrefs {
  seniorities: string[]; // Apollo person_seniorities values
  departments: string[]; // our department keys (see DEPARTMENT_OPTIONS)
  titles: string[]; // free-form title keywords
}

/** CTS Mobility defaults: Senior Manager / Director / VP, IT, VP-Manager titles. */
export const DEFAULT_CONTACT_PREFS: ContactPrefs = {
  seniorities: ["vp", "director", "manager"],
  departments: ["information_technology"],
  titles: ["VP", "Manager", "Senior Manager"],
};

/** Apollo's seniority taxonomy, with UI labels. */
export const SENIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "c_suite", label: "C-Level" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Senior Manager / Manager" },
  { value: "senior", label: "Senior IC" },
  { value: "owner", label: "Owner / Founder" },
  { value: "entry", label: "Entry level" },
];

/**
 * Departments we expose. Apollo has no "procurement" department, so that key
 * maps to title keywords instead of a department filter.
 */
export const DEPARTMENT_OPTIONS: Array<{ value: string; label: string; apollo: string | null }> = [
  { value: "information_technology", label: "IT", apollo: "information_technology" },
  { value: "operations", label: "Operations", apollo: "operations" },
  { value: "procurement", label: "Procurement", apollo: null },
  { value: "engineering_technical", label: "Engineering", apollo: "engineering_technical" },
  { value: "finance", label: "Finance", apollo: "finance" },
];

const PROCUREMENT_TITLES = ["Procurement", "Purchasing", "Sourcing"];
const VALID_SENIORITIES = new Set(SENIORITY_OPTIONS.map((o) => o.value));
const VALID_DEPARTMENTS = new Set(DEPARTMENT_OPTIONS.map((o) => o.value));

/** Parse the settings JSONB (or a client override) — unknown values dropped. */
export function parseContactPrefs(raw: unknown): ContactPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_CONTACT_PREFS;
  const obj = raw as Record<string, unknown>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
  const seniorities = strings(obj.seniorities).filter((s) => VALID_SENIORITIES.has(s));
  const departments = strings(obj.departments).filter((d) => VALID_DEPARTMENTS.has(d));
  const titles = strings(obj.titles)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 60)
    .slice(0, 12);
  // an explicitly-provided empty titles array means "no title filter"
  // (auto-relaxation uses this); fallback only when the field is absent
  const titlesProvided = Array.isArray(obj.titles);
  return {
    seniorities: seniorities.length > 0 ? seniorities : DEFAULT_CONTACT_PREFS.seniorities,
    departments, // empty = no department filter, that's a valid choice
    titles: titlesProvided ? titles : DEFAULT_CONTACT_PREFS.titles,
  };
}

export interface SearchFilters {
  seniorities: string[];
  titles: string[];
  apolloDepartments: string[];
}

/**
 * Prefs → the actual Apollo filters, with the revenue-band gate applied to
 * seniorities (large companies never search c_suite/owner even if selected)
 * and Procurement expanded into title keywords.
 */
export function buildSearchFilters(prefs: ContactPrefs, band: CompanyBand): SearchFilters {
  let seniorities = [...prefs.seniorities];
  if (band !== "small") seniorities = seniorities.filter((s) => s !== "owner");
  if (band === "large") seniorities = seniorities.filter((s) => s !== "c_suite");
  if (seniorities.length === 0) seniorities = ["vp", "director", "manager"];

  const titles = [...prefs.titles];
  if (prefs.departments.includes("procurement")) {
    for (const t of PROCUREMENT_TITLES) if (!titles.includes(t)) titles.push(t);
  }

  const apolloDepartments = prefs.departments
    .map((d) => DEPARTMENT_OPTIONS.find((o) => o.value === d)?.apollo)
    .filter((d): d is string => !!d);

  return { seniorities, titles, apolloDepartments };
}
