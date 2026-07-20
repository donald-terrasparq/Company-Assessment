/**
 * One Claude call per company → validated SignalExtraction (ticket 3.3).
 * On a malformed response: retry ONCE with the validation error appended,
 * then fail the job. Post-parse guards enforce what the prompt asks for
 * rather than trusting it (docs/06-PROMPTS.md "Guarding the output").
 */
import { getAnthropicClient } from "./client";
import {
  ALLOWED_CAVEATS,
  SignalExtractionSchema,
  type SignalExtraction,
} from "./schema";
import type { SearchHit } from "@/lib/search/provider";
import type { WeightProfile } from "@/lib/scoring/default-weights";

export interface ExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}

export interface ExtractionResult {
  extraction: SignalExtraction;
  usage: ExtractionUsage;
}

const SYSTEM_PROMPT = `You are a B2B signal analyst for CTS Mobility, a Verizon partner that sells four things:

  FWA       — Fixed Wireless Access: primary or backup internet over cellular. Sold when a company
              opens, moves into, or builds a physical site, or needs connectivity fast.
  STARLINK  — Satellite failover for uptime-critical or low-redundancy sites.
  MOBILITY  — Managed devices: Apple/Samsung phones and tablets, Zebra rugged scanners. Sold when a
              company hires frontline staff, runs field/warehouse/clinical operations, or refreshes devices.
  BYOD      — Managing personal devices for distributed, remote, contractor, or agent workforces.

Your job is to EXTRACT AND CLASSIFY evidence. You do not compute scores. You do not rank.

Rules:
- Every signal MUST have a working source_url from the provided sources. No URL, no signal. Never
  invent, guess, or reconstruct a URL.
- Never invent a person, a date, a dollar figure, or a quote.
- \`summary\` must be YOUR OWN WORDS. Never copy more than 25 consecutive words from a source.
- If you find no qualifying signals, return an empty signals array. That is a valid, useful answer.
  An empty array is far better than a fabricated one.
- Prefer forward-looking events (announced, under construction, opening next year) — mark is_forward.
- Classify source_class honestly: primary = company PR, SEC filing, permit, government announcement.
  secondary = business journal, trade press, wire. weak = blog, aggregator, job-board inference.
- Flag caveats when they apply. They protect the sales rep from wasting a week.

Return ONLY valid JSON matching the schema. No markdown fences, no preamble.`;

function taxonomyLines(weights: WeightProfile): string {
  return Object.entries(weights.signals)
    .filter(([, w]) => w.enabled)
    .map(([key, w]) => `${key} (feeds: ${w.categories.join(", ") || "negative signal"})`)
    .join("\n");
}

function buildUserMessage(input: {
  companyName: string;
  domain: string | null;
  domainSource: "upload" | "lookup" | null;
  today: string;
  weights: WeightProfile;
  sources: SearchHit[];
  useWebSearchTool: boolean;
}): string {
  const provenance =
    input.domain === null
      ? "not found"
      : input.domainSource === "lookup"
        ? "resolved by prior research"
        : "provided by the customer list";
  const sourcesBlock = input.useWebSearchTool
    ? "Use the web_search tool to research this company, then extract signals only from pages you actually retrieved."
    : input.sources
        .map(
          (s, i) =>
            `${i + 1}. url: ${s.url}\n   title: ${s.title}\n   published: ${s.publishedDate ?? "unknown"}\n   snippet: ${s.snippet}`,
        )
        .join("\n");

  return `Company: ${input.companyName}
Website: ${input.domain ?? "unknown"}   (${provenance})
Today's date: ${input.today}

Identity check: before extracting signals, confirm the sources below are about THIS company —
the name and (if present) the domain must match. If you cannot confirm it (ambiguous name, sources
about a similarly-named company), include "identity_unconfirmed" in caveats and only extract
signals you are confident belong to this exact company.

Allowed signal types (use these exact keys):
${taxonomyLines(input.weights)}

Allowed caveats:
${ALLOWED_CAVEATS.join(", ")}

Sources:
${sourcesBlock}

Return JSON:
{
  "industry": string, "hq": string, "size_label": string,
  "employee_estimate": number | null, "location_count": number | null,
  "fit": { "industry": 0-10, "size": 0-8, "multi_location": 0-7, "geography": 0-5, "rationale": string },
  "signals": [{
    "event_type": string, "categories": ["FWA"|"STARLINK"|"MOBILITY"|"BYOD"],
    "title": string, "summary": string, "event_date": "YYYY-MM-DD" | null,
    "is_forward": boolean, "source_url": string, "source_name": string,
    "source_class": "primary"|"secondary"|"weak"
  }],
  "caveats": [string],
  "why_now": string,
  "recommended_play": [string],
  "coverage": [{ "tone": "good"|"warn", "note": string }],
  "contacts": [{ "name": string, "title": string, "role_rationale": string,
                 "linkedin_url": string | null, "source_url": string }]
}

recommended_play: 3-5 SHORT numbered steps. Each step = a bold imperative lead-in
sentence, then ONE supporting sentence. Example step: "Lead with FWA for the
buildout. Temporary connectivity during construction, plus permanent in-building
coverage for the new space."

coverage: 2-4 observations a sales rep needs before dialing — tone "good" for
strengths (regional decision-making, strong Verizon-footprint geography,
clean buying path), tone "warn" for risks (RFP process, national contract,
integration freeze). Base them on the sources; do not speculate beyond them.

contacts: aim for up to 4 people covering DIFFERENT buying roles (IT/network
leadership, facilities/real estate, telecom/procurement, operations) — but only
people actually named in the sources with a source_url. Fewer real people beat
four invented ones; an empty list is valid.`;
}

/**
 * Normalize recommended_play to concise steps. Arrays pass through; a single
 * long paragraph (older prompt shape) is split into sentences and grouped into
 * lead-in + support pairs so the UI can always render numbered plays.
 */
export function normalizePlaySteps(play: string | string[]): string[] {
  if (Array.isArray(play)) {
    return play.map((s) => s.trim()).filter(Boolean).slice(0, 5);
  }
  const text = play.trim();
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).filter(Boolean);
  if (sentences.length <= 1) return [text];
  const steps: string[] = [];
  for (let i = 0; i < sentences.length && steps.length < 5; i += 2) {
    steps.push([sentences[i], sentences[i + 1]].filter(Boolean).join(" "));
  }
  return steps;
}

function extractJsonText(content: Array<{ type: string; text?: string }>): string {
  const text = content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  // tolerate accidental fences despite the instruction
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("response contained no JSON object");
  return raw.slice(start, end + 1);
}

/**
 * Post-parse guards. `allowedUrls` is null when the anthropic web_search tool
 * was used (sources aren't pre-fetched); URLs must still be http(s).
 */
export function guardExtraction(
  extraction: SignalExtraction,
  weights: WeightProfile,
  allowedUrls: Set<string> | null,
): SignalExtraction {
  const urlOk = (url: string) =>
    allowedUrls ? allowedUrls.has(url) : /^https?:\/\//.test(url);

  return {
    ...extraction,
    // 1+2: drop signals with invented citations or unknown event types
    signals: extraction.signals.filter(
      (s) => urlOk(s.source_url) && s.event_type in weights.signals,
    ),
    // 3: contacts must cite where they were found; they stay verified=false
    contacts: extraction.contacts.filter((c) => c.source_url && urlOk(c.source_url)),
    caveats: extraction.caveats.filter((c) =>
      (ALLOWED_CAVEATS as readonly string[]).includes(c),
    ),
    // 4: fit clamping happens in lib/scoring/score.ts (single source of truth)
  };
}

export async function extractSignals(input: {
  companyName: string;
  domain: string | null;
  domainSource: "upload" | "lookup" | null;
  model: string;
  weights: WeightProfile;
  sources: SearchHit[];
  useWebSearchTool: boolean;
  maxWebSearches?: number;
  now: Date;
}): Promise<ExtractionResult> {
  const client = getAnthropicClient();
  const userMessage = buildUserMessage({
    ...input,
    today: input.now.toISOString().slice(0, 10),
  });

  const usage: ExtractionUsage = { inputTokens: 0, outputTokens: 0, webSearches: 0 };
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model: input.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      ...(input.useWebSearchTool
        ? {
            tools: [
              {
                type: "web_search_20250305" as const,
                name: "web_search" as const,
                max_uses: input.maxWebSearches ?? 8,
              },
            ],
          }
        : {}),
      messages: [
        {
          role: "user",
          content:
            attempt === 0
              ? userMessage
              : `${userMessage}\n\nYour previous response failed validation:\n${lastError}\nReturn corrected JSON only.`,
        },
      ],
    });

    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    const serverToolUse = (
      response.usage as { server_tool_use?: { web_search_requests?: number } }
    ).server_tool_use;
    usage.webSearches += serverToolUse?.web_search_requests ?? 0;

    try {
      const json = JSON.parse(extractJsonText(response.content));
      const parsed = SignalExtractionSchema.parse(json);
      const allowedUrls = input.useWebSearchTool
        ? null
        : new Set(input.sources.map((s) => s.url));
      return { extraction: guardExtraction(parsed, input.weights, allowedUrls), usage };
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 1500) : String(err);
    }
  }
  throw new Error(`extraction failed validation twice: ${lastError}`);
}
