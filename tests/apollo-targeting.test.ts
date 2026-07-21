import { describe, expect, it } from "vitest";
import {
  companyBand,
  isAllowedContact,
  rankContacts,
  searchSeniorities,
} from "@/lib/apollo/targeting";

describe("companyBand", () => {
  it("revenue drives the band: <$20M small, $20M-$500M mid, >$500M large", () => {
    expect(companyBand(19_999_999, null)).toBe("small");
    expect(companyBand(20_000_000, null)).toBe("mid");
    expect(companyBand(500_000_000, null)).toBe("mid");
    expect(companyBand(500_000_001, null)).toBe("large");
  });

  it("falls back to headcount when revenue is unknown", () => {
    expect(companyBand(null, 50)).toBe("small");
    expect(companyBand(null, 400)).toBe("mid");
    expect(companyBand(null, 5000)).toBe("large");
  });

  it("defaults to mid (no CEO) when nothing is known", () => {
    expect(companyBand(null, null)).toBe("mid");
  });
});

describe("isAllowedContact — the CEO / C-level gates", () => {
  it("CEO is fine under $20M revenue", () => {
    expect(isAllowedContact("CEO", 5_000_000, null)).toBe(true);
    expect(isAllowedContact("Owner & Founder", 1_000_000, null)).toBe(true);
  });

  it("CEO is NEVER allowed at $20M+ revenue", () => {
    expect(isAllowedContact("CEO", 20_000_000, null)).toBe(false);
    expect(isAllowedContact("Chief Executive Officer", 80_000_000, null)).toBe(false);
    expect(isAllowedContact("CEO", 2_000_000_000, null)).toBe(false);
  });

  it("other C-level is allowed between $20M and $500M", () => {
    expect(isAllowedContact("CIO", 80_000_000, null)).toBe(true);
    expect(isAllowedContact("Chief Information Officer", 400_000_000, null)).toBe(true);
    expect(isAllowedContact("CTO", 500_000_000, null)).toBe(true);
  });

  it("no C-level at all above $500M revenue", () => {
    expect(isAllowedContact("CIO", 600_000_000, null)).toBe(false);
    expect(isAllowedContact("Chief Information Officer", 2_000_000_000, null)).toBe(false);
    expect(isAllowedContact("VP of Information Technology", 2_000_000_000, null)).toBe(true);
    expect(isAllowedContact("IT Director", 600_000_000, null)).toBe(true);
  });

  it("uses headcount when revenue is unknown (1,000+ ≈ >$500M)", () => {
    expect(isAllowedContact("CIO", null, 5000)).toBe(false);
    expect(isAllowedContact("CEO", null, 300)).toBe(false);
    expect(isAllowedContact("CEO", null, 40)).toBe(true);
  });
});

describe("searchSeniorities", () => {
  it("narrows as the company grows", () => {
    expect(searchSeniorities("small")).toContain("owner");
    expect(searchSeniorities("mid")).not.toContain("owner");
    expect(searchSeniorities("mid")).toContain("c_suite");
    expect(searchSeniorities("large")).not.toContain("c_suite");
    expect(searchSeniorities("large")).toContain("director");
  });
});

describe("rankContacts", () => {
  it("puts IT titles ahead of generic ops", () => {
    const ranked = rankContacts([
      { title: "Director of Operations" },
      { title: "VP of Information Technology" },
      { title: "Network Manager" },
    ]);
    expect(ranked[0].title).toBe("VP of Information Technology");
    expect(ranked[ranked.length - 1].title).toBe("Director of Operations");
  });
});
