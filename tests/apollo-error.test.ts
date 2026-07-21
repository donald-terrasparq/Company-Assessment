import { describe, expect, it } from "vitest";
import { ApolloError, apolloErrorMessage } from "@/lib/apollo/client";

describe("apolloErrorMessage — actionable UI messages per failure mode", () => {
  it("401 → check the key value", () => {
    const msg = apolloErrorMessage(new ApolloError(401, '{"error":"Invalid Api Key"}', "/mixed_people/search"));
    expect(msg).toContain("401");
    expect(msg).toContain("APOLLO env var");
  });

  it("403 → key scope / endpoint access, with Apollo's own words", () => {
    const msg = apolloErrorMessage(
      new ApolloError(403, '{"error":"This endpoint is not accessible with your api key"}', "/mixed_people/search"),
    );
    expect(msg).toContain("403");
    expect(msg).toContain("enable it");
    expect(msg).toContain("not accessible");
  });

  it("429 → rate limit", () => {
    expect(apolloErrorMessage(new ApolloError(429, "", "/people/match"))).toContain("rate limit");
  });

  it("status 0 → network problem", () => {
    expect(apolloErrorMessage(new ApolloError(0, "fetch failed", "/people/match"))).toContain("Could not reach");
  });

  it("non-Apollo errors get the generic message", () => {
    expect(apolloErrorMessage(new Error("boom"))).toContain("try again shortly");
  });
});
