import { describe, expect, it } from "vitest";
import {
  CTS_PROFILE,
  parseCompanyProfile,
  sellerBlock,
} from "@/lib/company/profile";

describe("parseCompanyProfile", () => {
  it("falls back to CTS for null/garbage", () => {
    expect(parseCompanyProfile(null).name).toBe("CTS Mobility");
    expect(parseCompanyProfile("x").products).toHaveLength(4);
  });

  it("keeps custom values and always yields exactly 4 slot-mapped products", () => {
    const p = parseCompanyProfile({
      name: "Acme Fiber",
      website: "acmefiber.com",
      industry: "Broadband",
      products: [{ slot: "FWA", label: "Fiber", description: "Sold on new construction." }],
      aiContext: { companyDescription: "Acme sells fiber.", signalGuidance: "Watch permits.", searchKeywords: "fiber, permits" },
    });
    expect(p.name).toBe("Acme Fiber");
    expect(p.products).toHaveLength(4);
    expect(p.products[0]).toMatchObject({ slot: "FWA", label: "Fiber" });
    // missing slots fall back to the CTS template so prompts never go empty
    expect(p.products[1].slot).toBe("STARLINK");
    expect(p.aiContext.companyDescription).toBe("Acme sells fiber.");
  });
});

describe("sellerBlock", () => {
  it("builds the analyst seller header from the profile", () => {
    const block = sellerBlock(CTS_PROFILE);
    expect(block).toContain("You are a B2B signal analyst for CTS Mobility");
    expect(block).toContain("FWA");
    expect(block).toContain("Fixed Wireless Access");
    expect(block).toContain("Analyst guidance:");
  });

  it("re-brands for a different company", () => {
    const block = sellerBlock(
      parseCompanyProfile({
        name: "Acme Fiber",
        industry: "Broadband",
        products: [{ slot: "FWA", label: "Fiber", description: "Sold on new construction." }],
        aiContext: { companyDescription: "d", signalGuidance: "Watch building permits.", searchKeywords: "fiber" },
      }),
    );
    expect(block).toContain("analyst for Acme Fiber");
    expect(block).toContain("broadband company");
    expect(block).toContain("Fiber: Sold on new construction.");
    expect(block).toContain("Watch building permits.");
  });
});
