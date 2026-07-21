import { describe, expect, it } from "vitest";
import { classifySegment, employeesFromLabel } from "@/lib/scoring/segment";

describe("classifySegment (SMB / Mid-Market / Enterprise)", () => {
  it("uses the standard employee thresholds: <100 / 100-999 / 1,000+", () => {
    expect(classifySegment({ employees: 45, annualRevenueUsd: null })).toBe("smb");
    expect(classifySegment({ employees: 99, annualRevenueUsd: null })).toBe("smb");
    expect(classifySegment({ employees: 100, annualRevenueUsd: null })).toBe("mid_market");
    expect(classifySegment({ employees: 999, annualRevenueUsd: null })).toBe("mid_market");
    expect(classifySegment({ employees: 1000, annualRevenueUsd: null })).toBe("enterprise");
    expect(classifySegment({ employees: 7500, annualRevenueUsd: null })).toBe("enterprise");
  });

  it("uses revenue thresholds: <$50M / $50M-$1B / $1B+", () => {
    expect(classifySegment({ employees: null, annualRevenueUsd: 8_000_000 })).toBe("smb");
    expect(classifySegment({ employees: null, annualRevenueUsd: 50_000_000 })).toBe("mid_market");
    expect(classifySegment({ employees: null, annualRevenueUsd: 999_000_000 })).toBe("mid_market");
    expect(classifySegment({ employees: null, annualRevenueUsd: 1_000_000_000 })).toBe("enterprise");
  });

  it("revenue promotes upward but never demotes headcount", () => {
    // 300-person firm doing $2B → Enterprise
    expect(classifySegment({ employees: 300, annualRevenueUsd: 2_000_000_000 })).toBe("enterprise");
    // 60-person firm doing $80M → Mid-Market
    expect(classifySegment({ employees: 60, annualRevenueUsd: 80_000_000 })).toBe("mid_market");
    // 5,000-person firm with tiny reported revenue stays Enterprise
    expect(classifySegment({ employees: 5000, annualRevenueUsd: 1_000_000 })).toBe("enterprise");
  });

  it("falls back to parsing the size label when no estimate exists", () => {
    expect(classifySegment({ employees: null, annualRevenueUsd: null, sizeLabel: "1,000+ employees" })).toBe("enterprise");
    expect(classifySegment({ employees: null, annualRevenueUsd: null, sizeLabel: "201–500 employees" })).toBe("mid_market");
    expect(classifySegment({ employees: null, annualRevenueUsd: null, sizeLabel: "~40 staff" })).toBe("smb");
  });

  it("falls back to location count when headcount and revenue are unknown", () => {
    // the Micro Center case: ~25 stores, no headcount/revenue extracted → Mid-Market
    expect(classifySegment({ employees: null, annualRevenueUsd: null, locationCount: 25 })).toBe("mid_market");
    expect(classifySegment({ employees: null, annualRevenueUsd: null, locationCount: 150 })).toBe("enterprise");
    expect(classifySegment({ employees: null, annualRevenueUsd: null, locationCount: 3 })).toBe("smb");
  });

  it("a 10+ site footprint outranks a small partial headcount", () => {
    expect(classifySegment({ employees: 50, annualRevenueUsd: null, locationCount: 12 })).toBe("mid_market");
    expect(classifySegment({ employees: 50, annualRevenueUsd: null, locationCount: 2 })).toBe("smb");
  });

  it("returns null when headcount, revenue, and locations are all unknown", () => {
    expect(classifySegment({ employees: null, annualRevenueUsd: null, sizeLabel: null })).toBeNull();
    expect(classifySegment({ employees: null, annualRevenueUsd: null, sizeLabel: "unknown" })).toBeNull();
  });

  it("employeesFromLabel picks the largest number in a range", () => {
    expect(employeesFromLabel("201–500 employees")).toBe(500);
    expect(employeesFromLabel("1,000+ employees")).toBe(1000);
    expect(employeesFromLabel(null)).toBeNull();
  });
});
