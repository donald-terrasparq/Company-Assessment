"use client";

/** Data sources tab: one-click Apollo key check with a safe key fingerprint. */
import { useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthResult {
  ok: boolean;
  detail: string;
  keySource: string | null;
  keyFingerprint: string | null;
}

export function ApolloTestButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/apollo/health");
      setResult((await res.json()) as HealthResult);
    } catch {
      setResult({ ok: false, detail: "Request failed — is the app deployed?", keySource: null, keyFingerprint: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={test}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-[#cdd4de] disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <PlugZap size={14} aria-hidden />}
        Test Apollo connection
      </button>
      {result && (
        <div
          className={cn(
            "mt-2 rounded-[10px] px-3 py-2.5 text-[12px] leading-[1.5]",
            result.ok ? "bg-tier1-soft text-tier1" : "bg-spark-soft text-spark",
          )}
        >
          <b>{result.ok ? "Connected." : "Not connected."}</b> {result.detail}
          {result.keyFingerprint && (
            <span className="mono block text-[11px] opacity-80">
              key from {result.keySource}: {result.keyFingerprint} — compare with the key shown in
              Apollo&apos;s API settings
            </span>
          )}
        </div>
      )}
    </div>
  );
}
