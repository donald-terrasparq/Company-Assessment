/** Pure ETA math for run progress: rate so far → time for what's left. */
export function estimateRemainingSeconds(
  elapsedSeconds: number,
  closedJobs: number,
  pendingJobs: number,
): number | null {
  if (closedJobs < 1 || pendingJobs <= 0 || elapsedSeconds <= 0) return null;
  return Math.round((elapsedSeconds / closedJobs) * pendingJobs);
}
