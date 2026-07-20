"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { fmtDuration } from "@/lib/utils";

interface Progress {
  status: string;
  total: number;
  done: number;
  failed: number;
  pending: number;
  phase?: "first_pass" | "second_pass";
  elapsedSeconds?: number | null;
  estRemainingSeconds?: number | null;
}

const ACTIVE = new Set(["queued", "running"]);

/** Run button + live progress (polls /api/runs/:id/progress every 3s). */
export function RunControls({
  listId,
  latestRunId,
  latestRunStatus,
}: {
  listId: string;
  latestRunId: string | null;
  latestRunStatus: string | null;
}) {
  const router = useRouter();
  const [runId, setRunId] = useState(latestRunId);
  const [status, setStatus] = useState(latestRunStatus);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const poll = useCallback(
    (id: string) => {
      stopPolling();
      timer.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/runs/${id}/progress`);
          if (!res.ok) return;
          const p = (await res.json()) as Progress;
          setProgress(p);
          setStatus(p.status);
          if (!ACTIVE.has(p.status)) {
            stopPolling();
            router.refresh();
          }
        } catch {
          // transient poll failures are fine
        }
      }, 3000);
    },
    [router, stopPolling],
  );

  useEffect(() => {
    if (runId && status && ACTIVE.has(status)) poll(runId);
    return stopPolling;
  }, [runId, status, poll, stopPolling]);

  async function startRun() {
    setError(null);
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: listId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? `Failed (${res.status})`);
      return;
    }
    setRunId(body.run_id);
    setStatus("queued");
    setProgress(null);
    poll(body.run_id);
  }

  if (status && ACTIVE.has(status)) {
    const done = (progress?.done ?? 0) + (progress?.failed ?? 0);
    const total = progress?.total ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="min-w-[190px]">
        <div className="mb-1 h-2 overflow-hidden rounded-full bg-line-2">
          <div className="h-full rounded-full bg-spark transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mono text-[10.5px] text-muted">
          {total > 0 ? `${done} of ${total} analyzed` : "starting…"}
          {progress && progress.failed > 0 ? ` · ${progress.failed} failed` : ""}
          {progress?.phase === "second_pass" ? " · 2nd pass (high accuracy)" : ""}
        </div>
        {progress?.elapsedSeconds ? (
          <div className="mono text-[10.5px] text-muted">
            {fmtDuration(progress.elapsedSeconds)} elapsed
            {progress.estRemainingSeconds != null
              ? ` · ~${fmtDuration(progress.estRemainingSeconds)} left`
              : ""}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={startRun}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1 text-[11.5px] font-medium text-slate transition-colors hover:border-[#cdd4de] hover:text-ink"
      >
        <Play size={12} aria-hidden />
        {status ? "Re-run" : "Run analysis"}
      </button>
      {status === "halted_budget" && (
        <span className="text-[10.5px] font-semibold text-tier2">halted: budget cap</span>
      )}
      {error && <span className="max-w-[180px] text-[10.5px] text-spark">{error}</span>}
    </div>
  );
}
