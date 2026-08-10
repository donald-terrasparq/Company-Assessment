import { describe, expect, it } from "vitest";
import { mergeContacts, manualDisplayName, type AutoContact, type ManualContact } from "@/lib/contacts/merge";

const auto = (over: Partial<AutoContact> = {}): AutoContact => ({
  id: "a1",
  name: "Jane Doe",
  title: "IT Director",
  roleRationale: "owns WAN",
  linkedinUrl: null,
  email: null,
  phone: null,
  source: "apollo",
  verified: true,
  phoneRequested: false,
  ...over,
});

const manual = (over: Partial<ManualContact> = {}): ManualContact => ({
  id: "m1",
  firstName: "Sam",
  lastName: "Lee",
  title: "CIO",
  email: "sam@acme.com",
  phone: null,
  overridesName: null,
  ...over,
});

describe("manualDisplayName", () => {
  it("joins first and last, tolerating a missing last name", () => {
    expect(manualDisplayName({ firstName: "Sam", lastName: "Lee" })).toBe("Sam Lee");
    expect(manualDisplayName({ firstName: "Sam", lastName: null })).toBe("Sam");
  });
});

describe("mergeContacts", () => {
  it("passes auto contacts through untouched when there are no manual rows", () => {
    const out = mergeContacts([auto()], []);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Jane Doe");
    expect(out[0].manualId).toBeNull();
  });

  it("appends standalone manual contacts with a manual_ id and manual source", () => {
    const out = mergeContacts([auto()], [manual()]);
    expect(out).toHaveLength(2);
    const m = out[1];
    expect(m.id).toBe("manual_m1");
    expect(m.name).toBe("Sam Lee");
    expect(m.source).toBe("manual");
    expect(m.verified).toBe(false);
    expect(m.manualId).toBe("m1");
  });

  it("applies a correction's non-empty fields over the matching auto row", () => {
    const out = mergeContacts(
      [auto()],
      [manual({ overridesName: "jane doe", firstName: "Jane", lastName: "Doe-Smith", email: "jane@acme.com", title: null })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Jane Doe-Smith");
    expect(out[0].email).toBe("jane@acme.com");
    expect(out[0].title).toBe("IT Director"); // null in the correction → auto value kept
    expect(out[0].verified).toBe(true); // provenance untouched
    expect(out[0].manualId).toBe("m1");
  });

  it("degrades an orphaned correction (auto row gone after re-run) into a standalone row", () => {
    const out = mergeContacts([], [manual({ overridesName: "Jane Doe" })]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("manual_m1");
    expect(out[0].name).toBe("Sam Lee");
    expect(out[0].source).toBe("manual");
  });

  it("matches override names case-insensitively and keeps other autos intact", () => {
    const other = auto({ id: "a2", name: "Bob Ray" });
    const out = mergeContacts([auto(), other], [manual({ overridesName: "JANE DOE", phone: "555" })]);
    expect(out.find((c) => c.id === "a1")?.phone).toBe("555");
    expect(out.find((c) => c.id === "a2")?.manualId).toBeNull();
    expect(out).toHaveLength(2);
  });
});
