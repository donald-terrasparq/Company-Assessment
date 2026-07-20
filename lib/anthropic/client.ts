import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side only (hard rule 1): ANTHROPIC_API_KEY is read from process env
 * inside the worker / route handlers. It must never be NEXT_PUBLIC_, never a
 * prop, never a response field.
 */
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({
      timeout: 120_000, // one extraction call must never hang a worker slot for the SDK's 10-min default
      maxRetries: 1,
    });
  }
  return client;
}
