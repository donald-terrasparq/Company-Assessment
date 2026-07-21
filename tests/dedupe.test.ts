import { describe, expect, it } from "vitest";
import { dedupeBestByCompany } from "@/lib/prospects/dedupe";

const row = (resultId: string, companyName: string, domain: string | null, totalScore: number) => ({
  resultId,
  companyName,
  domain,
  totalScore,
});

describe("dedupeBestByCompany (VIEW ALL / VIEW SELECTED combine rule)", () => {
  it("keeps every distinct company and ranks by score desc", () => {
    const out = dedupeBestByCompany([
      row("1", "Alpha", "alpha.com", 40),
      row("2", "Beta", "beta.com", 90),
      row("3", "Gamma", "gamma.com", 60),
    ]);
    expect(out.map((r) => r.resultId)).toEqual(["2", "3", "1"]);
  });

  it("same domain across lists → best score wins", () => {
    const out = dedupeBestByCompany([
      row("a", "Same Co", "same.com", 50),
      row("b", "Same Co", "same.com", 70),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].resultId).toBe("b");
  });

  it("no domain falls back to case-insensitive name; distinct names never collapse", () => {
    const out = dedupeBestByCompany([
      row("a", "Bristol Metals", null, 40),
      row("b", "bristol metals", null, 55),
      row("c", "Riverbend Clinics", null, 30),
    ]);
    expect(out.map((r) => r.resultId)).toEqual(["b", "c"]);
  });
});
