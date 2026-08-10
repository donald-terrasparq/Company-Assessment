import { describe, expect, it } from "vitest";
import { mapNews, mapOrganization, mapOrganizationDetails } from "@/lib/apollo/organization";

describe("mapOrganization", () => {
  it("extracts the firmographic numbers and builds prompt facts", () => {
    const out = mapOrganization({
      organization: {
        id: "org_1",
        name: "Micro Center",
        estimated_num_employees: 4800,
        annual_revenue: 2_500_000_000,
        retail_location_count: 28,
        founded_year: 1979,
        technology_names: ["Cisco Meraki", "VMware Workspace ONE"],
      },
    });
    expect(out.orgId).toBe("org_1");
    expect(out.employees).toBe(4800);
    expect(out.revenueUsd).toBe(2_500_000_000);
    expect(out.locationCount).toBe(28);
    expect(out.facts[0]).toContain("~4,800 employees");
    expect(out.facts[0]).toContain("$2,500M annual revenue");
    expect(out.facts[0]).toContain("28 retail locations");
    expect(out.facts.some((f) => f.includes("Cisco Meraki"))).toBe(true);
  });

  it("includes funding facts when present", () => {
    const out = mapOrganization({
      organization: {
        id: "o",
        latest_funding_stage: "Series C",
        latest_funding_round_date: "2026-03-15T00:00:00Z",
        total_funding_printed: "$120M",
      },
    });
    expect(out.facts.some((f) => f.includes("Series C") && f.includes("2026-03-15") && f.includes("$120M"))).toBe(true);
  });

  it("returns empty data when Apollo has no organization", () => {
    const out = mapOrganization({});
    expect(out.orgId).toBeNull();
    expect(out.employees).toBeNull();
    expect(out.facts).toEqual([]);
  });
});

describe("mapNews", () => {
  it("keeps only articles with a resolvable URL (hard rule 3) and maps to SearchHits", () => {
    const hits = mapNews({
      news_articles: [
        { title: "New store opening in Austin", url: "https://news.example.com/a", published_at: "2026-06-01T12:00:00Z", event: "expansion" },
        { title: "No URL — must be dropped", url: null },
        { title: "Bad scheme", url: "ftp://x" },
      ],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      url: "https://news.example.com/a",
      title: "New store opening in Austin",
      publishedDate: "2026-06-01",
      source: "apollo_news",
    });
  });

  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      title: `Article ${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(mapNews({ news_articles: many }).length).toBeLessThanOrEqual(8);
  });
});

describe("mapOrganizationDetails (0016 company-enrichment snapshot)", () => {
  it("maps the persisted detail fields incl. LinkedIn and description", () => {
    const out = mapOrganizationDetails({
      organization: {
        id: "org_1",
        linkedin_url: "https://www.linkedin.com/company/micro-center",
        short_description: "Retailer of computers and electronics.",
        industry: "Retail",
        founded_year: 1979,
        estimated_num_employees: 4800,
        annual_revenue: 2_500_000_000,
        retail_location_count: 28,
        publicly_traded_symbol: null,
        total_funding_printed: "$10M",
        latest_funding_stage: "Series A",
        latest_funding_round_date: "2025-03-04T00:00:00Z",
        technology_names: ["Cisco Meraki"],
        keywords: ["electronics", "Cisco Meraki"],
      },
    });
    expect(out).not.toBeNull();
    expect(out!.linkedinUrl).toContain("linkedin.com/company");
    expect(out!.description).toContain("Retailer");
    expect(out!.latestFundingDate).toBe("2025-03-04");
    expect(out!.keywords).toEqual(["Cisco Meraki", "electronics"]); // deduped
  });

  it("returns null when Apollo has no organization", () => {
    expect(mapOrganizationDetails({})).toBeNull();
  });
});
