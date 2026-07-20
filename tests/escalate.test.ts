import { describe, expect, it } from "vitest";
import { selectForEscalation, type EscalationInput } from "@/lib/scoring/escalate";
import { estimateRemainingSeconds } from "@/lib/jobs/eta";
import { estimateRun } from "@/lib/costs/estimate";

const T1 = 63;
const T2 = 38;

function input(id: string, over: Partial<NonNullable<EscalationInput["result"]>> = {}, jobFailed = false): EscalationInput {
  return {
    companyId: id,
    jobFailed,
    result: jobFailed
      ? null
      : {
          totalScore: 50,
          fitScore: 15,
          triggerScore: 35,
          signalCount: 3,
          caveats: [],
          locationCount: 5,
          employeeEstimate: 200,
          allSourcesWeak: false,
          ...over,
        },
  };
}

describe("selectForEscalation triggers", () => {
  it("0% selects nothing; 100% selects every triggered company", () => {
    const inputs = [input("a", { totalScore: 63 }), input("b", { totalScore: 10, fitScore: 5 })];
    expect(selectForEscalation(inputs, T1, T2, 0)).toEqual([]);
    const all = selectForEscalation(inputs, T1, T2, 100);
    expect(all.map((c) => c.companyId)).toEqual(["a"]); // b triggers nothing
  });

  it("failed jobs escalate with top priority", () => {
    const out = selectForEscalation(
      [input("fail", {}, true), input("borderline", { totalScore: 60 })],
      T1,
      T2,
      100,
    );
    expect(out[0]).toMatchObject({ companyId: "fail", priority: 1, reasons: ["extraction_failed"] });
  });

  it("detects every trigger with its reason", () => {
    const cases: Array<[string, Partial<NonNullable<EscalationInput["result"]>>, string]> = [
      ["t1", { totalScore: 58 }, "borderline_tier_1"],
      ["id", { caveats: ["identity_unconfirmed"] }, "identity_unconfirmed"],
      ["thin", { fitScore: 25, signalCount: 1 }, "high_fit_thin_evidence"],
      ["foot", { locationCount: null, employeeEstimate: 900 }, "footprint_suspicion"],
      ["t2", { totalScore: 40 }, "borderline_tier_2"],
      ["weak", { allSourcesWeak: true }, "weak_sources_only"],
    ];
    for (const [id, over, reason] of cases) {
      const out = selectForEscalation([input(id, over)], T1, T2, 100);
      expect(out.map((c) => c.reasons).flat(), id).toContain(reason);
    }
  });

  it("caps at pct of list, keeping highest priority", () => {
    const inputs = [
      input("clear", { totalScore: 90, signalCount: 5 }), // no trigger
      input("weak", { allSourcesWeak: true }), // p7
      input("borderT1", { totalScore: 64 }), // p2
      input("failed", {}, true), // p1
      input("ident", { caveats: ["identity_unconfirmed"] }), // p3
    ];
    const out = selectForEscalation(inputs, T1, T2, 40); // 40% of 5 = 2
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.companyId)).toEqual(["failed", "borderT1"]);
  });

  it("solid mid-list companies with nothing ambiguous are never escalated", () => {
    const out = selectForEscalation(
      [input("solid", { totalScore: 52, signalCount: 4, fitScore: 18 })],
      T1,
      T2,
      100,
    );
    expect(out).toEqual([]);
  });
});

describe("estimateRemainingSeconds", () => {
  it("extrapolates from the observed rate", () => {
    expect(estimateRemainingSeconds(120, 4, 6)).toBe(180); // 30s/job × 6 left
    expect(estimateRemainingSeconds(120, 0, 6)).toBeNull(); // no data yet
    expect(estimateRemainingSeconds(120, 4, 0)).toBeNull(); // nothing left
  });
});

describe("estimateRun with escalation", () => {
  it("adds the high-accuracy second pass for the escalated share", () => {
    const base = estimateRun(100, "claude-sonnet-5", "brave", 0);
    const twoPass = estimateRun(100, "claude-sonnet-5", "brave", 20);
    expect(twoPass.escalated).toBe(20);
    expect(twoPass.totalUsd).toBeGreaterThan(base.totalUsd);
    expect(twoPass.escalationCostUsd).toBeGreaterThan(3);
  });

  it("does not escalate when the base model is already high-accuracy", () => {
    const est = estimateRun(100, "claude-opus-4-8", "brave", 20);
    expect(est.escalated).toBe(0);
  });
});
