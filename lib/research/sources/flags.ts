/** Per-source toggles. All free sources default ON; set env to "0" to disable. */
export function usaspendingEnabled(): boolean {
  return process.env.ENRICH_USASPENDING !== "0";
}
