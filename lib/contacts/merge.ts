/**
 * Merge auto-found contacts (per-run, rebuilt on every re-analysis) with
 * manual_contacts rows (durable, keyed on the company). Pure & unit-testable.
 *
 * Two kinds of manual rows:
 *  - standalone (overridesName = null): rendered as their own contact rows
 *  - corrections (overridesName = original auto-found name): their non-empty
 *    fields win over the matching auto row, which keeps its identity
 */

export interface AutoContact {
  id: string;
  name: string;
  title: string | null;
  roleRationale: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  verified: boolean;
  phoneRequested: boolean;
}

export interface ManualContact {
  id: string;
  firstName: string;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  overridesName: string | null;
}

export interface MergedContact extends AutoContact {
  /** Set when the row is manual or carries a manual correction — enables edit-in-place. */
  manualId: string | null;
}

export function manualDisplayName(m: Pick<ManualContact, "firstName" | "lastName">): string {
  return [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
}

const norm = (s: string) => s.trim().toLowerCase();

export function mergeContacts(auto: AutoContact[], manual: ManualContact[]): MergedContact[] {
  const overrides = new Map<string, ManualContact>();
  const standalone: ManualContact[] = [];
  for (const m of manual) {
    if (m.overridesName) overrides.set(norm(m.overridesName), m);
    else standalone.push(m);
  }

  const merged: MergedContact[] = auto.map((c) => {
    const o = overrides.get(norm(c.name));
    if (!o) return { ...c, manualId: null };
    const correctedName = manualDisplayName(o);
    return {
      ...c,
      name: correctedName || c.name,
      title: o.title ?? c.title,
      email: o.email ?? c.email,
      phone: o.phone ?? c.phone,
      manualId: o.id,
    };
  });

  // a correction whose auto row vanished (re-run found different people)
  // degrades gracefully into a standalone manual contact
  const matchedIds = new Set(merged.map((c) => c.manualId).filter(Boolean));
  const orphans = [...overrides.values()].filter((o) => !matchedIds.has(o.id));

  for (const m of [...standalone, ...orphans]) {
    merged.push({
      id: `manual_${m.id}`,
      name: manualDisplayName(m) || (m.overridesName ?? ""),
      title: m.title,
      roleRationale: null,
      linkedinUrl: null,
      email: m.email,
      phone: m.phone,
      source: "manual",
      verified: false,
      phoneRequested: false,
      manualId: m.id,
    });
  }
  return merged;
}
