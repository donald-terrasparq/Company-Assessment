/**
 * Minimal .env.local loader for standalone tsx scripts (migrate/seed).
 * Next.js loads .env.local itself; these scripts run outside Next, so they
 * read it here. Real env vars always win — on Render nothing is read from disk.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvLocal(): void {
  const file = resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const quote = value[0];
    if (quote === '"' || quote === "'") {
      // quoted value — ends at the matching quote; anything after (inline comment) is dropped
      const closing = value.indexOf(quote, 1);
      value = closing === -1 ? value.slice(1) : value.slice(1, closing);
    } else {
      // unquoted value — strip an inline " #comment"
      const hash = value.search(/\s+#/);
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
