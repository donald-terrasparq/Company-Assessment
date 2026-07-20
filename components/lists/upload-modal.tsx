"use client";

/**
 * Upload flow (docs/04-UI-SPEC.md §3): drop & preview → name → map columns →
 * create. The 100-company cap is enforced here first (blocked Continue, live
 * counter, "Use first 100" secondary action) and again in POST /api/lists.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { estimateRun } from "@/lib/costs/estimate";

const MAX_ROWS = 100;
const MAX_BYTES = 5 * 1024 * 1024;

type ParsedFile = {
  filename: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  file: File;
};

type Step = "drop" | "name" | "map" | "done";

function guessColumn(headers: string[], patterns: RegExp[]): string {
  for (const p of patterns) {
    const hit = headers.find((h) => p.test(h));
    if (hit) return hit;
  }
  return "";
}

async function parseUpload(file: File): Promise<ParsedFile> {
  if (file.size > MAX_BYTES) throw new Error("File exceeds the 5 MB limit.");
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv") {
    const Papa = (await import("papaparse")).default;
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) =>
          resolve({
            filename: file.name,
            headers: res.meta.fields ?? [],
            rows: res.data,
            file,
          }),
        error: (err: Error) => reject(err),
      });
    });
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    return { filename: file.name, headers: Object.keys(rows[0] ?? {}), rows, file };
  }
  throw new Error("Drop a .csv or .xlsx file.");
}

const inputCls =
  "rounded-[10px] border border-line bg-card px-3 py-2.5 text-[14px] text-ink outline-none focus:border-steel w-full";

export function UploadModal({
  initialOpen,
  estimator,
}: {
  initialOpen: boolean;
  /** admin-only (Phase 6): model + provider for the run cost estimate; null hides it */
  estimator: { model: string; searchProvider: string; escalationPct: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState<Step>("drop");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [name, setName] = useState("");
  const [nameCol, setNameCol] = useState("");
  const [siteCol, setSiteCol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    display_name: string;
    company_count: number;
    duplicates_removed: number;
    unparseable_urls: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const count = parsed?.rows.length ?? 0;
  const overCap = count > MAX_ROWS;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const reset = useCallback(() => {
    setStep("drop");
    setParsed(null);
    setName("");
    setNameCol("");
    setSiteCol("");
    setError(null);
    setResult(null);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
    router.replace("/lists");
    router.refresh();
  }, [reset, router]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const p = await parseUpload(file);
      if (p.rows.length === 0) throw new Error("The file has no data rows.");
      setParsed(p);
      setNameCol(guessColumn(p.headers, [/^company[_ ]?name$/i, /company/i, /^name$/i]));
      setSiteCol(guessColumn(p.headers, [/^web[_ ]?site$/i, /website|url|domain|web/i]));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function useFirst100() {
    if (!parsed) return;
    setParsed({ ...parsed, rows: parsed.rows.slice(0, MAX_ROWS) });
  }

  async function submit() {
    if (!parsed || !nameCol) return;
    setBusy(true);
    setError(null);
    try {
      const rows = parsed.rows
        .map((r) => {
          const rawName = String(r[nameCol] ?? "").trim();
          const website = siteCol ? String(r[siteCol] ?? "").trim() : "";
          const raw: Record<string, unknown> = {};
          for (const h of parsed.headers) {
            if (h !== nameCol && h !== siteCol) raw[h] = r[h];
          }
          return { company_name: rawName, website: website || null, raw };
        })
        .filter((r) => r.company_name.length > 0);

      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({ name, filename: parsed.filename, rows }),
      );
      form.set("file", parsed.file);
      const res = await fetch("/api/lists", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      setResult(body);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-ink bg-ink px-[15px] py-[9px] text-[13px] font-medium text-white transition-colors hover:bg-[#1b2d43]"
        title="Max 100 companies per list"
      >
        <UploadCloud size={15} aria-hidden />
        Upload list
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div className="w-full max-w-xl rounded-card border border-line bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-disp text-[17px] font-semibold text-ink">Upload a list</h2>
          <span className="mono text-[11px] text-muted">Up to 100 companies per list</span>
          <span className="flex-1" />
          <button type="button" onClick={close} title="Close" className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {step === "drop" && (
          <div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="grid w-full place-items-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-[#cfd6e0] px-6 py-10 text-muted transition-colors hover:border-spark hover:bg-spark-soft hover:text-spark"
            >
              <UploadCloud size={22} aria-hidden />
              <span className="text-[13px]">
                Drop a .csv or .xlsx — max 100 companies, 5 MB
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />

            {parsed && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-3 text-[13px]">
                  <span className="font-medium text-ink">{parsed.filename}</span>
                  <span
                    className={cn(
                      "mono rounded-full px-2.5 py-0.5 text-[11.5px] font-bold",
                      overCap
                        ? "bg-spark-soft text-spark"
                        : count >= 90
                          ? "bg-[#FBF0DA] text-tier2"
                          : "bg-line-2 text-slate",
                    )}
                  >
                    {count} / {MAX_ROWS}
                  </span>
                </div>
                {overCap && (
                  <p className="mb-2 rounded-[10px] bg-spark-soft px-3 py-2 text-[12.5px] font-medium text-spark">
                    This file has {count} companies. The limit is {MAX_ROWS} per list — split
                    it into two lists.
                  </p>
                )}
                <div className="max-h-48 overflow-auto rounded-[10px] border border-line-2">
                  <table className="w-full text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-line-2 text-muted">
                        {parsed.headers.slice(0, 5).map((h) => (
                          <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-b border-line-2 last:border-none">
                          {parsed.headers.slice(0, 5).map((h) => (
                            <td key={h} className="px-2 py-1.5 text-slate">
                              {String(r[h] ?? "").slice(0, 40)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  {overCap && (
                    <button
                      type="button"
                      onClick={useFirst100}
                      className="rounded-[10px] border border-line bg-card px-4 py-2 text-[13px] font-medium text-ink hover:border-[#cdd4de]"
                    >
                      Use first {MAX_ROWS}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={overCap}
                    onClick={() => setStep("name")}
                    className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "name" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-slate">List name (required)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pre-Intent Leads"
                className={inputCls}
              />
            </label>
            {name.trim() && (
              <p className="text-[12.5px] text-muted">
                Will be saved as <b className="text-slate">{name.trim()} — {today}</b>
              </p>
            )}
            <div className="mt-2 flex justify-between">
              <button type="button" onClick={() => setStep("drop")} className="text-[13px] text-slate hover:text-ink">
                ← Back
              </button>
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => setStep("map")}
                className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43] disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "map" && parsed && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-slate">
                Company name column (required)
              </span>
              <select value={nameCol} onChange={(e) => setNameCol(e.target.value)} className={inputCls}>
                <option value="">— choose —</option>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-slate">
                Website column (optional — helps pinpoint the exact company; missing domains
                are looked up during research)
              </span>
              <select value={siteCol} onChange={(e) => setSiteCol(e.target.value)} className={inputCls}>
                <option value="">— none —</option>
                {parsed.headers
                  .filter((h) => h !== nameCol)
                  .map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
              </select>
            </label>
            <p className="text-[12px] text-muted">
              Unmapped columns are preserved with each company. Duplicates are removed on
              website domain, then on name.
            </p>
            {estimator &&
              (() => {
                const est = estimateRun(
                  count,
                  estimator.model,
                  estimator.searchProvider,
                  estimator.escalationPct,
                );
                return (
                  <p className="mono rounded-[10px] border border-line-2 bg-[#FBFCFD] px-3 py-2 text-[11.5px] text-slate">
                    Analyzing {est.companies} companies ≈{" "}
                    <b className="text-ink">${est.totalUsd.toFixed(2)}</b> · ~{est.minutes} min
                    <span className="text-muted">
                      {" "}
                      ({est.searches} searches
                      {est.searchCostUsd > 0 ? ` $${est.searchCostUsd.toFixed(2)}` : " free tier"} +
                      tokens ${est.tokenCostUsd.toFixed(2)}
                      {est.escalated > 0
                        ? ` + ~${est.escalated} high-accuracy 2nd-pass $${est.escalationCostUsd.toFixed(2)}`
                        : ""})
                    </span>
                  </p>
                );
              })()}
            {error && (
              <p className="rounded-[10px] bg-spark-soft px-3 py-2 text-[12.5px] font-medium text-spark">
                {error}
              </p>
            )}
            <div className="mt-2 flex justify-between">
              <button type="button" onClick={() => setStep("name")} className="text-[13px] text-slate hover:text-ink">
                ← Back
              </button>
              <button
                type="button"
                disabled={!nameCol || busy}
                onClick={submit}
                className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43] disabled:opacity-50"
              >
                {busy ? "Creating…" : `Create list · ${count} companies`}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col gap-3">
            <p className="rounded-[10px] bg-tier1-soft px-3 py-2 text-[13px] font-medium text-tier1">
              Created <b>{result.display_name}</b> with {result.company_count} companies.
            </p>
            <ul className="text-[12.5px] text-slate">
              {result.duplicates_removed > 0 && (
                <li>• {result.duplicates_removed} duplicate row(s) removed</li>
              )}
              {result.unparseable_urls > 0 && (
                <li className="text-tier2">
                  • {result.unparseable_urls} row(s) had unparseable URLs — their domains will
                  be looked up during research
                </li>
              )}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2d43]"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {step === "drop" && error && (
          <p className="mt-3 rounded-[10px] bg-spark-soft px-3 py-2 text-[12.5px] font-medium text-spark">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
