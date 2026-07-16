import { describe, expect, it } from "vitest";
import { normalizeDomain } from "@/lib/normalize/domain";

describe("normalizeDomain (docs/05 Phase 2 tests)", () => {
  it("normalizes scheme, case, www, and path", () => {
    expect(normalizeDomain("https://WWW.Example.com/about")).toBe("example.com");
  });

  it("accepts bare domains", () => {
    expect(normalizeDomain("www.mcirocenter.com")).toBe("mcirocenter.com");
    expect(normalizeDomain("erlanger.org")).toBe("erlanger.org");
  });

  it("returns null for unparseable input", () => {
    expect(normalizeDomain("not a url")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain("just-a-word")).toBeNull();
  });

  it("keeps subdomains other than www", () => {
    expect(normalizeDomain("http://app.ctsmobility.com/x?y=1")).toBe("app.ctsmobility.com");
  });
});
