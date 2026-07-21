/**
 * Email pitch drafting (Draft Email modal). One cheap balanced-model call;
 * the same no-fabrication rules as research apply: the email may reference
 * only the facts we hand it.
 */
import { getAnthropicClient } from "./client";
import { BALANCED_MODEL, estimateTokenCostUsd } from "./models";
import { EMAIL_STYLES } from "@/lib/email-styles";

export interface EmailContext {
  companyName: string;
  domain: string | null;
  industry: string | null;
  hq: string | null;
  whyNow: string | null;
  play: string; // the selected recommended-play step
  contact: { name: string; title: string | null } | null;
  styleKey: string;
  signals: Array<{ title: string; date: string | null; sourceName: string | null }>;
}

/** Pure prompt builder — unit-testable. */
export function buildEmailPrompt(ctx: EmailContext): string {
  const style =
    EMAIL_STYLES.find((s) => s.key === ctx.styleKey) ??
    EMAIL_STYLES.find((s) => s.key === "consultative")!;
  const recipient = ctx.contact
    ? `${ctx.contact.name}${ctx.contact.title ? `, ${ctx.contact.title}` : ""}`
    : "the IT leadership team (no named contact — use a role-appropriate greeting like \"Hi there\" and write for an IT decision-maker)";

  return `Draft a cold outreach email from a CTS Mobility sales rep.

CTS Mobility is a Verizon partner selling: Fixed Wireless Access (fast primary/backup
internet over cellular), Starlink satellite failover, managed mobility (phones/tablets/
rugged devices), and BYOD management.

Company being contacted: ${ctx.companyName}${ctx.domain ? ` (${ctx.domain})` : ""}
${ctx.industry ? `Industry: ${ctx.industry}` : ""}
${ctx.hq ? `HQ: ${ctx.hq}` : ""}
Recipient: ${recipient}
${ctx.whyNow ? `Why now: ${ctx.whyNow}` : ""}

The angle to pitch (verbatim from our research — build the email around THIS):
${ctx.play}

Verified recent events you may reference (nothing else):
${ctx.signals.map((s) => `- ${s.title}${s.date ? ` (${s.date})` : ""}${s.sourceName ? ` — ${s.sourceName}` : ""}`).join("\n") || "- (none — write without referencing specific events)"}

Style: ${style.label}. ${style.instructions}

HARD RULES:
- Reference ONLY the facts above. Never invent numbers, dates, names, products, or claims.
- Never fabricate familiarity ("we spoke last year") or social proof ("we work with your competitors").
- No pricing. No attachments mentioned.
- Sign off with the placeholders: [Your name], CTS Mobility, [Your phone].
- Subject line under 60 characters, specific to their situation, no clickbait.

Return ONLY JSON: { "subject": string, "body": string }
The body uses \\n\\n between paragraphs. No markdown.`;
}

export interface DraftedEmail {
  subject: string;
  body: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export async function draftEmail(ctx: EmailContext): Promise<DraftedEmail> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: BALANCED_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildEmailPrompt(ctx) }],
  });
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("")
    .trim();

  let subject = `Re: ${ctx.companyName}`;
  let body = text;
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
      if (parsed.subject && parsed.body) {
        subject = parsed.subject;
        body = parsed.body;
      }
    } catch {
      // fall back to raw text as the body
    }
  }

  return {
    subject,
    body,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: estimateTokenCostUsd(
      BALANCED_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens,
    ),
  };
}
