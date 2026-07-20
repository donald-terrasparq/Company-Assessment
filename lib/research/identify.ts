/**
 * Stage 1 of research (ticket 3.1b): when a company has no domain, resolve the
 * official website from public sources and write it back with
 * domain_source = 'lookup'. Never guesses a domain from the name — an
 * unresolvable domain stays NULL and research proceeds on name alone.
 */
import { getAnthropicClient } from "@/lib/anthropic/client";
import { DomainResolutionSchema } from "@/lib/anthropic/schema";
import { normalizeDomain } from "@/lib/normalize/domain";
import type { SearchHit, SearchProvider } from "@/lib/search/provider";

export interface IdentifyOutcome {
  domain: string | null;
  usage: { inputTokens: number; outputTokens: number; searches: number };
}

export async function resolveDomain(input: {
  companyName: string;
  hqHint: string | null;
  model: string;
  provider: SearchProvider;
}): Promise<IdentifyOutcome> {
  const queries = [
    `"${input.companyName}" official website`,
    ...(input.hqHint ? [`"${input.companyName}" ${input.hqHint}`] : []),
  ];
  const hits: SearchHit[] = [];
  let searches = 0;
  for (const q of queries) {
    try {
      hits.push(...(await input.provider.search(q, { limit: 5 })));
      searches++;
    } catch {
      // a failed identity search is non-fatal — extraction may still flag identity_unconfirmed
    }
  }
  if (hits.length === 0) {
    return { domain: null, usage: { inputTokens: 0, outputTokens: 0, searches } };
  }

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: input.model,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Which of these results is the official website of the company named "${input.companyName}"?
Return JSON: { "domain": string | null, "evidence_url": string | null }
- domain must be the bare registrable domain of the OFFICIAL site (no scheme, no www, no path).
- evidence_url must be one of the provided result URLs.
- If none of the results is clearly this company's official site, return domain: null.
  Never construct a domain from the company name.

Results:
${hits.map((h, i) => `${i + 1}. ${h.url} — ${h.title} — ${h.snippet.slice(0, 140)}`).join("\n")}

Return ONLY the JSON object.`,
      },
    ],
  });

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    searches,
  };

  try {
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { domain: null, usage };
    const parsed = DomainResolutionSchema.parse(JSON.parse(match[0]));
    // require the evidence URL to come from the actual hits — no fabrication
    if (!parsed.evidence_url || !hits.some((h) => h.url === parsed.evidence_url)) {
      return { domain: null, usage };
    }
    return { domain: normalizeDomain(parsed.domain), usage };
  } catch {
    return { domain: null, usage };
  }
}
