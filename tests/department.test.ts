import { describe, expect, it } from "vitest";
import { departmentForTitle } from "@/lib/contacts/department";

describe("departmentForTitle", () => {
  it("classifies IT titles first, even with ops words present", () => {
    expect(departmentForTitle("VP of Information Technology")).toBe("it");
    expect(departmentForTitle("IT Operations Manager")).toBe("it");
    expect(departmentForTitle("CIO")).toBe("it");
    expect(departmentForTitle("Director of Network Infrastructure")).toBe("it");
    expect(departmentForTitle("CISO")).toBe("it");
  });

  it("classifies the other departments", () => {
    expect(departmentForTitle("Chief Financial Officer")).toBe("finance");
    expect(departmentForTitle("Corporate Controller")).toBe("finance");
    expect(departmentForTitle("Director of Operations")).toBe("operations");
    expect(departmentForTitle("Supply Chain Manager")).toBe("operations");
    expect(departmentForTitle("VP Marketing")).toBe("marketing");
    expect(departmentForTitle("Senior Engineering Manager")).toBe("engineering");
    expect(departmentForTitle("Head of Procurement")).toBe("procurement");
    expect(departmentForTitle("Purchasing Agent")).toBe("procurement");
  });

  it("falls back to general", () => {
    expect(departmentForTitle(null)).toBe("general");
    expect(departmentForTitle("Executive Assistant")).toBe("general");
  });
});
