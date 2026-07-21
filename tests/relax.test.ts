import { describe, expect, it } from "vitest";
import { DEFAULT_CONTACT_PREFS } from "@/lib/apollo/prefs";
import { MIN_CONTACT_TARGET, relaxationLadder } from "@/lib/apollo/relax";

describe("relaxationLadder", () => {
  it("aims for at least 2 contacts", () => {
    expect(MIN_CONTACT_TARGET).toBe(2);
  });

  it("step 1 is the request as-is; department is removed FIRST, then titles", () => {
    const steps = relaxationLadder(DEFAULT_CONTACT_PREFS);
    expect(steps[0].note).toBe("requested filters");
    expect(steps[0].prefs).toEqual(DEFAULT_CONTACT_PREFS);
    expect(steps[1].note).toBe("department filter removed");
    expect(steps[1].prefs.departments).toEqual([]);
    expect(steps[1].prefs.titles).toEqual(DEFAULT_CONTACT_PREFS.titles); // titles intact
    expect(steps[2].note).toBe("department and title filters removed");
    expect(steps[2].prefs.titles).toEqual([]);
  });

  it("then broadens seniority downward, cumulatively", () => {
    const steps = relaxationLadder(DEFAULT_CONTACT_PREFS); // vp/director/manager
    const broadening = steps.filter((s) => s.note.startsWith("seniority broadened"));
    expect(broadening[0].prefs.seniorities).toEqual(
      expect.arrayContaining(["vp", "director", "manager", "head"]),
    );
    expect(broadening[1].prefs.seniorities).toEqual(expect.arrayContaining(["head", "senior"]));
    expect(broadening.at(-1)!.prefs.seniorities).toEqual(expect.arrayContaining(["entry"]));
    // broadened steps keep department/titles removed
    for (const s of broadening) {
      expect(s.prefs.departments).toEqual([]);
      expect(s.prefs.titles).toEqual([]);
    }
  });

  it("ends with the everything-open step and dedupes no-op steps", () => {
    const steps = relaxationLadder({ seniorities: ["vp"], departments: [], titles: [] });
    // departments/titles were already empty → those steps collapse away
    expect(steps[0].note).toBe("requested filters");
    expect(steps[1].note).toContain("seniority broadened");
    const last = steps.at(-1)!;
    expect(last.note).toBe("all seniorities, no department or title filters");
    expect(last.prefs.seniorities).toEqual(expect.arrayContaining(["c_suite", "owner", "entry"]));
  });
});
