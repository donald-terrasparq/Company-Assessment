/** Human-readable caveat copy (docs/03-SIGNAL-MODEL.md), shared by UI + export. */
export interface CaveatCopy {
  label: string;
  detail: string;
  capsTier: boolean;
}

export const CAVEAT_COPY: Record<string, CaveatCopy> = {
  enterprise_procurement: {
    label: "Enterprise / national procurement",
    detail:
      "Fortune-500-scale; a national carrier contract probably already exists and buying runs through corporate procurement.",
    capsTier: true,
  },
  foreign_hq: {
    label: "Foreign HQ",
    detail: "Decisions may be made overseas.",
    capsTier: false,
  },
  overseas_growth: {
    label: "Overseas growth",
    detail: "The growth is real but outside Verizon's footprint.",
    capsTier: true,
  },
  holding_company: {
    label: "Holding company",
    detail: "PE firm / parent entity — the portfolio companies are the actual leads.",
    capsTier: true,
  },
  franchise_model: {
    label: "Franchise model",
    detail: "Franchisees buy their own connectivity — sell to the franchisee, not the brand.",
    capsTier: false,
  },
  single_site: {
    label: "Single site",
    detail: "One location; FWA upside is limited to failover.",
    capsTier: false,
  },
  public_procurement: {
    label: "Public procurement",
    detail: "RFP process; longer cycle — confirm the buying path early.",
    capsTier: false,
  },
  identity_unconfirmed: {
    label: "Identity unconfirmed",
    detail:
      "Research could not confirm the sources match this exact company — the signals may belong to a similarly-named business. Verify before outreach.",
    capsTier: true,
  },
  defunct: {
    label: "Defunct / acquired",
    detail: "Company no longer exists independently.",
    capsTier: true,
  },
};
