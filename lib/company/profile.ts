/**
 * Company profile (Settings → Company): makes the tool re-brandable. One
 * profile is ACTIVE at a time and defines who the seller is — company facts,
 * up to four target products (mapped onto the four internal signal slots
 * FWA / STARLINK / MOBILITY / BYOD), and the AI context text that steers
 * research, extraction, and email drafting. CTS Mobility ships as the
 * default active profile.
 */

export const PRODUCT_SLOTS = ["FWA", "STARLINK", "MOBILITY", "BYOD"] as const;
export type ProductSlot = (typeof PRODUCT_SLOTS)[number];

export interface CompanyProduct {
  slot: ProductSlot; // internal category key the product maps onto
  label: string; // display/pitch name, e.g. "FWA" or "Fiber Broadband"
  description: string; // when this product is sold — fed to the analyst prompt
}

export interface CompanyAiContext {
  companyDescription: string; // one-paragraph seller intro (email prompt)
  signalGuidance: string; // extra analyst instructions (extraction prompt)
  searchKeywords: string; // comma-separated hints fed to the analyst
}

export interface CompanyProfile {
  id?: string;
  name: string;
  website: string;
  industry: string;
  products: CompanyProduct[];
  aiContext: CompanyAiContext;
}

export const CTS_PROFILE: CompanyProfile = {
  name: "CTS Mobility",
  website: "www.ctsmobility.com",
  industry: "Telecommunications",
  products: [
    {
      slot: "FWA",
      label: "FWA",
      description:
        "Fixed Wireless Access: primary or backup internet over cellular. Sold when a company opens, moves into, or builds a physical site, or needs connectivity fast.",
    },
    {
      slot: "STARLINK",
      label: "Starlink",
      description: "Satellite failover for uptime-critical or low-redundancy sites.",
    },
    {
      slot: "MOBILITY",
      label: "Mobility",
      description:
        "Managed devices: Apple/Samsung phones and tablets, Zebra rugged scanners. Sold when a company hires frontline staff, runs field/warehouse/clinical operations, or refreshes devices.",
    },
    {
      slot: "BYOD",
      label: "BYOD",
      description:
        "Managing personal devices for distributed, remote, contractor, or agent workforces.",
    },
  ],
  aiContext: {
    companyDescription:
      "CTS Mobility is a Verizon partner selling: Fixed Wireless Access (fast primary/backup internet over cellular), Starlink satellite failover, managed mobility (phones/tablets/rugged devices), and BYOD management.",
    signalGuidance:
      "Favor physical-footprint events (new sites, expansions, relocations), uptime/continuity pressure, frontline hiring, and device-fleet moments. IT teams are the primary buyers.",
    searchKeywords:
      "new location, expansion, network, connectivity, internet outage, devices, tablets, field workforce",
  },
};

/** Parse a stored/submitted profile — malformed parts fall back to CTS shape. */
export function parseCompanyProfile(raw: unknown): CompanyProfile {
  if (!raw || typeof raw !== "object") return CTS_PROFILE;
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown, fallback: string, max = 4000): string =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;

  const rawProducts = Array.isArray(obj.products) ? obj.products : [];
  const products: CompanyProduct[] = PRODUCT_SLOTS.map((slot, i) => {
    const p = (rawProducts[i] ?? {}) as Record<string, unknown>;
    const fallback = CTS_PROFILE.products[i];
    return {
      slot,
      label: str(p.label, fallback.label, 40),
      description: str(p.description, fallback.description, 500),
    };
  });

  const ai = (obj.aiContext ?? {}) as Record<string, unknown>;
  return {
    id: typeof obj.id === "string" ? obj.id : undefined,
    name: str(obj.name, CTS_PROFILE.name, 120),
    website: str(obj.website, CTS_PROFILE.website, 200),
    industry: str(obj.industry, CTS_PROFILE.industry, 120),
    products,
    aiContext: {
      companyDescription: str(ai.companyDescription, CTS_PROFILE.aiContext.companyDescription),
      signalGuidance: str(ai.signalGuidance, CTS_PROFILE.aiContext.signalGuidance),
      searchKeywords: str(ai.searchKeywords, CTS_PROFILE.aiContext.searchKeywords, 500),
    },
  };
}

/** The seller block of the extraction system prompt, built from the profile. */
export function sellerBlock(profile: CompanyProfile): string {
  const products = profile.products
    .map((p) => `  ${p.slot.padEnd(9)} — ${p.label}: ${p.description}`)
    .join("\n");
  return `You are a B2B signal analyst for ${profile.name}, a ${profile.industry.toLowerCase()} company that sells four things:

${products}

Analyst guidance: ${profile.aiContext.signalGuidance}
Useful search themes: ${profile.aiContext.searchKeywords}.`;
}
