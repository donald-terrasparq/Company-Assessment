import { describe, expect, it } from "vitest";
import { normalizePlaySteps } from "@/lib/anthropic/extract";

describe("normalizePlaySteps", () => {
  it("passes arrays through, trimmed and capped at 5", () => {
    const steps = normalizePlaySteps([
      " Lead with FWA. Buildout connectivity. ",
      "Layer mobility. Devices for staff.",
      "", "a. b", "c. d", "e. f", "g. h",
    ]);
    expect(steps).toHaveLength(5);
    expect(steps[0]).toBe("Lead with FWA. Buildout connectivity.");
  });

  it("splits a legacy single paragraph into lead-in + support pairs", () => {
    const steps = normalizePlaySteps(
      "Lead with FWA for the buildout. Temporary connectivity during construction. Layer mobility for clinical growth. Managed phones and tablets for staff. Enter through Facilities and IT. The buildout owner and the network owner.",
    );
    expect(steps).toHaveLength(3);
    expect(steps[0]).toBe(
      "Lead with FWA for the buildout. Temporary connectivity during construction.",
    );
    expect(steps[2]).toBe(
      "Enter through Facilities and IT. The buildout owner and the network owner.",
    );
  });

  it("returns empty for empty input and keeps single sentences whole", () => {
    expect(normalizePlaySteps("")).toEqual([]);
    expect(normalizePlaySteps([])).toEqual([]);
    expect(normalizePlaySteps("One single recommendation without breaks")).toEqual([
      "One single recommendation without breaks",
    ]);
  });
});
