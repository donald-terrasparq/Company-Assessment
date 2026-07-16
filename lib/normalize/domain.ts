/**
 * Domain normalization (docs/02-DATA-MODEL.md): lowercase, scheme stripped,
 * leading www. stripped, path/query dropped. Unparseable input → null, never
 * a throw — bad URLs in uploaded spreadsheets are common and must not crash
 * the parse.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  try {
    const hostname = new URL(s).hostname.replace(/^www\./, "");
    // require a dot and a plausible hostname; "not a url" and bare words fail here
    if (!hostname.includes(".")) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(hostname)) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}
