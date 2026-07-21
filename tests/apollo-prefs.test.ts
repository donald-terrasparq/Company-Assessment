import { describe, expect, it } from "vitest";
import {
  buildSearchFilters,
  DEFAULT_CONTACT_PREFS,
  parseContactPrefs,
} from "@/lib/apollo/prefs";

describe("parseContactPrefs", () => {
  it("returns CTS defaults for null/garbage", () => {
    expect(parseContactPrefs(null)).toEqual(DEFAULT_CONTACT_PREFS);
    expect(parseContactPrefs("nope")).toEqual(DEFAULT_CONTACT_PREFS);
  });

  it("CTS defaults are Senior Manager/Director/VP, IT, VP-Manager titles", () => {
    expect(DEFAULT_CONTACT_PREFS.seniorities).toEqual(["vp", "director", "manager"]);
    expect(DEFAULT_CONTACT_PREFS.departments).toEqual(["information_technology"]);
    expect(DEFAULT_CONTACT_PREFS.titles).toEqual(["VP", "Manager", "Senior Manager"]);
  });

  it("drops unknown seniorities/departments, keeps valid ones", () => {
    const p = parseContactPrefs({
      seniorities: ["vp", "galactic_overlord"],
      departments: ["information_technology", "astrology"],
      titles: ["  CIO  ", ""],
    });
    expect(p.seniorities).toEqual(["vp"]);
    expect(p.departments).toEqual(["information_technology"]);
    expect(p.titles).toEqual(["CIO"]);
  });

  it("explicit empty departments/titles are valid (relaxed state); missing titles fall back", () => {
    const p = parseContactPrefs({ seniorities: [], departments: [], titles: [] });
    expect(p.departments).toEqual([]);
    expect(p.titles).toEqual([]); // explicitly no title filter — auto-relaxation uses this
    expect(p.seniorities).toEqual(DEFAULT_CONTACT_PREFS.seniorities);
    const q = parseContactPrefs({ seniorities: ["vp"], departments: [] }); // titles absent
    expect(q.titles).toEqual(DEFAULT_CONTACT_PREFS.titles);
  });
});

describe("buildSearchFilters", () => {
  it("large companies never search c_suite/owner even if selected", () => {
    const f = buildSearchFilters(
      { seniorities: ["c_suite", "owner", "vp"], departments: [], titles: ["CIO"] },
      "large",
    );
    expect(f.seniorities).toEqual(["vp"]);
  });

  it("small companies keep owner and c_suite", () => {
    const f = buildSearchFilters(
      { seniorities: ["c_suite", "owner", "vp"], departments: [], titles: ["CIO"] },
      "small",
    );
    expect(f.seniorities).toEqual(["c_suite", "owner", "vp"]);
  });

  it("procurement expands into title keywords, not a department", () => {
    const f = buildSearchFilters(
      { seniorities: ["vp"], departments: ["procurement", "information_technology"], titles: ["VP"] },
      "mid",
    );
    expect(f.apolloDepartments).toEqual(["information_technology"]);
    expect(f.titles).toEqual(expect.arrayContaining(["VP", "Procurement", "Purchasing", "Sourcing"]));
  });
});
