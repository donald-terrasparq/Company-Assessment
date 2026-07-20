import { describe, expect, it } from "vitest";
import { estimateRun } from "@/lib/costs/estimate";
import { SEARCHES_PER_COMPANY } from "@/lib/research/gather";

describe("estimateRun (docs/07-COSTS.md)", () => {
  it("brave is token-only; anthropic adds $10/1k searches", () => {
    const brave = estimateRun(100, "claude-sonnet-5", "brave");
    expect(brave.searches).toBe(100 * SEARCHES_PER_COMPANY);
    expect(brave.searchCostUsd).toBe(0);
    expect(brave.tokenCostUsd).toBeGreaterThan(0);

    const anthropic = estimateRun(100, "claude-sonnet-5", "anthropic");
    expect(anthropic.searchCostUsd).toBeCloseTo(anthropic.searches * 0.01, 5);
    expect(anthropic.totalUsd).toBeGreaterThan(brave.totalUsd);
  });

  it("a 100-company Sonnet run is single-digit dollars", () => {
    const est = estimateRun(100, "claude-sonnet-5", "brave");
    expect(est.totalUsd).toBeGreaterThan(1);
    expect(est.totalUsd).toBeLessThan(10);
    expect(est.minutes).toBeGreaterThanOrEqual(15);
  });

  it("rounds the total up to the cent", () => {
    const est = estimateRun(7, "claude-sonnet-5", "brave");
    expect(est.totalUsd).toBeGreaterThanOrEqual(est.searchCostUsd + est.tokenCostUsd);
  });
});
