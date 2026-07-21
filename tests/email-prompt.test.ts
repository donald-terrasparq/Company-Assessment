import { describe, expect, it } from "vitest";
import { buildEmailPrompt, type EmailContext } from "@/lib/anthropic/email";
import { EMAIL_STYLES, DEFAULT_STYLE_KEY } from "@/lib/email-styles";

function ctx(overrides: Partial<EmailContext> = {}): EmailContext {
  return {
    companyName: "Erlanger Health",
    domain: "erlanger.org",
    industry: "Healthcare",
    hq: "Chattanooga, TN",
    whyNow: "A new tower opens next year.",
    play: "Lead with FWA for the new tower. Backup circuits are on their radar.",
    contact: { name: "Jordan Reyes", title: "VP of IT" },
    styleKey: "consultative",
    signals: [
      { title: "New patient tower announced", date: "2026-05-01", sourceName: "Times Free Press" },
    ],
    ...overrides,
  };
}

describe("buildEmailPrompt", () => {
  it("includes the selected play, contact, and company facts", () => {
    const p = buildEmailPrompt(ctx());
    expect(p).toContain("Lead with FWA for the new tower.");
    expect(p).toContain("Jordan Reyes, VP of IT");
    expect(p).toContain("Erlanger Health (erlanger.org)");
    expect(p).toContain("New patient tower announced (2026-05-01) — Times Free Press");
  });

  it("carries the selected style's instructions", () => {
    for (const style of EMAIL_STYLES) {
      const p = buildEmailPrompt(ctx({ styleKey: style.key }));
      expect(p).toContain(style.instructions);
    }
  });

  it("falls back to the default style for an unknown key", () => {
    const fallback = EMAIL_STYLES.find((s) => s.key === DEFAULT_STYLE_KEY)!;
    expect(buildEmailPrompt(ctx({ styleKey: "nope" }))).toContain(fallback.instructions);
  });

  it("handles no contact and no signals without inventing anything", () => {
    const p = buildEmailPrompt(ctx({ contact: null, signals: [] }));
    expect(p).toContain("no named contact");
    expect(p).toContain("(none — write without referencing specific events)");
    expect(p).not.toContain("Jordan Reyes");
  });

  it("always states the no-fabrication rules and placeholders", () => {
    const p = buildEmailPrompt(ctx());
    expect(p).toContain("Never invent");
    expect(p).toContain("[Your name]");
    expect(p).toContain("CTS Mobility");
  });

  it("a single email has no sequence block", () => {
    expect(buildEmailPrompt(ctx())).not.toContain("SEQUENCE:");
    expect(buildEmailPrompt(ctx({ sequencePosition: 1, sequenceLength: 1 }))).not.toContain(
      "SEQUENCE:",
    );
  });

  it("email 1 of N sets up the sequence without follow-up rules", () => {
    const p = buildEmailPrompt(ctx({ sequencePosition: 1, sequenceLength: 3 }));
    expect(p).toContain("email 1 of a planned 3-email");
    expect(p).not.toContain("FOLLOW-UP");
  });

  it("follow-up emails get the follow-up rules", () => {
    const p = buildEmailPrompt(ctx({ sequencePosition: 2, sequenceLength: 3 }));
    expect(p).toContain("FOLLOW-UP email 2 of 3");
    expect(p).toContain("NOT replied");
    expect(p).toContain("25% shorter");
    expect(p).toContain("Fresh subject line");
  });
});
