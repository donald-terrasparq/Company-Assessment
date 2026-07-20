import { describe, expect, it } from "vitest";
import { editDistance, shouldCorrectDomain } from "@/lib/normalize/domain";
import { normalizePlaySteps } from "@/lib/anthropic/extract";

describe("editDistance", () => {
  it("counts edits", () => {
    expect(editDistance("mcirocenter", "microcenter")).toBe(2); // transposition = 2 edits
    expect(editDistance("same", "same")).toBe(0);
    expect(editDistance("abc", "xyz")).toBe(3);
  });
});

describe("shouldCorrectDomain (the mcirocenter.com case)", () => {
  it("corrects near-miss typos of the official domain", () => {
    expect(shouldCorrectDomain("Micro Center", "mcirocenter.com", "microcenter.com")).toBe(true);
  });
  it("corrects when the official domain equals the compacted company name", () => {
    expect(shouldCorrectDomain("Lowes Foods", "lowesfood.com", "lowesfoods.com")).toBe(true);
  });
  it("leaves legitimately different domains alone", () => {
    expect(shouldCorrectDomain("Erlanger Health", "erlanger.org", "wikipedia.org")).toBe(false);
    expect(shouldCorrectDomain("Acme", "acme-industrial.com", "totallydifferent.com")).toBe(false);
    expect(shouldCorrectDomain("Micro Center", "microcenter.com", "microcenter.com")).toBe(false);
  });
});

describe("normalizePlaySteps handles markdown-bolded single blobs (ASML case)", () => {
  it("splits a **bold**-riddled paragraph into distinct plays", () => {
    const blob =
      "**Target the new-build campuses for temporary and permanent FWA.** Both expansions need interim connectivity plus in-building coverage. **Position Starlink failover for the US support network.** Uptime-critical operations are a natural fit. **Approach US facilities separately from global HQ.** Decision-making is concentrated in the Netherlands. **Use the capacity-expansion news as the entry hook.** Reference the guidance raise to open the conversation.";
    const steps = normalizePlaySteps(blob);
    expect(steps).toHaveLength(4);
    expect(steps[0]).toBe(
      "Target the new-build campuses for temporary and permanent FWA. Both expansions need interim connectivity plus in-building coverage.",
    );
    expect(steps[0]).not.toContain("**");
  });

  it("strips numbering and bullets from array elements", () => {
    expect(normalizePlaySteps(["1. Do X. Because Y.", "- Do Z. Because W."])).toEqual([
      "Do X. Because Y.",
      "Do Z. Because W.",
    ]);
  });
});
