import { describe, expect, it } from "vitest";
import {
  buildDisplayName,
  dedupeRows,
  validateListPayload,
  MAX_COMPANIES_PER_LIST,
} from "@/lib/lists/validate";

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    company_name: `Company ${i}`,
    website: `https://company-${i}.com`,
    raw: {},
  }));
}

describe("100-company cap (docs/05 Phase 2 tests)", () => {
  it("accepts exactly 100 rows", () => {
    const r = validateListPayload({ name: "Q3", filename: "a.csv", rows: rows(100) });
    expect(r.ok).toBe(true);
  });

  it("rejects 101 rows with a 422 naming the actual count", () => {
    const r = validateListPayload({ name: "Q3", filename: "a.csv", rows: rows(101) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.message).toContain("101");
      expect(r.message).toContain(String(MAX_COMPANIES_PER_LIST));
    }
  });

  it("requires a list name and at least one row", () => {
    expect(validateListPayload({ name: "", filename: "a.csv", rows: rows(1) }).ok).toBe(false);
    expect(validateListPayload({ name: "x", filename: "a.csv", rows: [] }).ok).toBe(false);
  });
});

describe("display name", () => {
  it("appends the upload date", () => {
    expect(buildDisplayName("Pre-Intent Leads", new Date("2026-07-09T15:00:00Z"))).toBe(
      "Pre-Intent Leads — 2026-07-09",
    );
  });
});

describe("dedupe", () => {
  it("dedupes on normalized domain, else name; counts bad URLs", () => {
    const outcome = dedupeRows([
      { company_name: "Acme", website: "https://WWW.Acme.com/about", raw: {} },
      { company_name: "Acme Inc", website: "acme.com", raw: {} }, // same domain
      { company_name: "NoSite", website: null, raw: {} },
      { company_name: "nosite", website: undefined, raw: {} }, // same normalized name
      { company_name: "BadUrl", website: "not a url", raw: {} }, // unparseable → domain null
    ]);
    expect(outcome.rows).toHaveLength(3);
    expect(outcome.duplicatesRemoved).toBe(2);
    expect(outcome.unparseableUrls).toBe(1);
    expect(outcome.rows[0].domain).toBe("acme.com");
    expect(outcome.rows[2].domain).toBeNull();
    expect(outcome.rows[2].website).toBe("not a url"); // raw string preserved
  });
});
