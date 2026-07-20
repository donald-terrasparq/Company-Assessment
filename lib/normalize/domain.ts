/**
 * Domain normalization (docs/02-DATA-MODEL.md): lowercase, scheme stripped,
 * leading www. stripped, path/query dropped. Unparseable input → null, never
 * a throw — bad URLs in uploaded spreadsheets are common and must not crash
 * the parse.
 */
/** Small edit distance (Levenshtein) for typo detection. */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/**
 * Should an uploaded domain be auto-corrected to the registry's official one?
 * (The mcirocenter.com → microcenter.com case.) Deliberately conservative:
 * only when the official domain plainly matches the company name, or the two
 * domains are a near-miss typo (edit distance ≤ 2 on the first label).
 */
export function shouldCorrectDomain(
  companyName: string,
  currentDomain: string,
  officialDomain: string,
): boolean {
  if (currentDomain === officialDomain) return false;
  const compactName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const officialLabel = officialDomain.split(".")[0] ?? "";
  const currentLabel = currentDomain.split(".")[0] ?? "";
  if (compactName.length >= 5 && officialLabel === compactName) return true;
  return (
    currentLabel.length >= 5 && editDistance(currentLabel, officialLabel) <= 2
  );
}

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
