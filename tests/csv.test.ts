import { describe, expect, it } from "vitest";
import { applyFilters, prospectsToCsv } from "@/lib/export/csv";
import type { ProspectRow } from "@/lib/db/queries/prospects";

function row(over: Partial<ProspectRow>): ProspectRow {
  return {
    resultId: "r1",
    companyId: "c1",
    companyName: "Acme",
    website: null,
    domain: "acme.com",
    domainSource: "upload",
    listId: "l1",
    listName: "List — 2026-07-16",
    industry: "Retail",
    hq: "Austin, TX",
    sizeLabel: "500–2k",
    employeeEstimate: null,
    annualRevenueUsd: null,
    locationCount: null,
    fitScore: 20,
    triggerScore: 40,
    totalScore: 60,
    tier: "tier_2",
    fwaScore: 55,
    starlinkScore: 30,
    mobilityScore: 45,
    byodScore: 20,
    primaryCategory: "FWA",
    whyNow: 'Opening 3 stores, said "go"',
    recencyLabel: "<30d",
    caveats: [],
    ...over,
  };
}

describe("prospectsToCsv", () => {
  it("escapes quotes and commas, ranks rows", () => {
    const csv = prospectsToCsv([row({ hq: "Austin, TX" })]);
    const [header, line] = csv.trim().split("\r\n");
    expect(header.startsWith("rank,company,domain")).toBe(true);
    expect(line.startsWith("1,Acme,acme.com")).toBe(true);
    expect(line).toContain('"Austin, TX"');
    expect(line).toContain('"Opening 3 stores, said ""go"""');
  });
});

describe("applyFilters (export honors active filters)", () => {
  const rows = [
    row({ resultId: "a", tier: "tier_1", primaryCategory: "FWA", recencyLabel: "forward" }),
    row({ resultId: "b", tier: "tier_2", primaryCategory: "MOBILITY", recencyLabel: ">12mo" }),
    row({ resultId: "c", tier: "tier_1", primaryCategory: "FWA", caveats: ["enterprise_procurement"] }),
  ];

  it("filters by tier, category, freshness, and caveats", () => {
    expect(applyFilters(rows, { tiers: ["tier_1"], categories: [], freshOnly: false, hideCaveats: false })).toHaveLength(2);
    expect(applyFilters(rows, { tiers: [], categories: ["MOBILITY"], freshOnly: false, hideCaveats: false })).toHaveLength(1);
    expect(applyFilters(rows, { tiers: [], categories: [], freshOnly: true, hideCaveats: false }).map((r) => r.resultId)).toEqual(["a", "c"]);
    expect(applyFilters(rows, { tiers: [], categories: [], freshOnly: false, hideCaveats: true })).toHaveLength(2);
  });

  it("empty filters pass everything", () => {
    expect(applyFilters(rows, { tiers: [], categories: [], freshOnly: false, hideCaveats: false })).toHaveLength(3);
  });
});
