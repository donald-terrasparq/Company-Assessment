"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCcw } from "lucide-react";
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
  failedCompanies?: Array<{ name: string; error: string | null }>;
}

const ACTIVE = new Set(["queued", "running"]);

/** Run button + live progress with elapsed/ETA, plus retry for failed companies. */
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

  const fetchProgress = useCallback(async (id: string): Promise<Progress | null> => {
    try {
      const res = await fetch(`/api/runs/${id}/progress`);
      if (!res.ok) return null;
      return (await res.json()) as Progress;
    } catch {
      return null;
    }
  }, []);

  const poll = useCallback(
    (id: string) => {
      stopPolling();
      timer.current = setInterval(async () => {
        const p = await fetchProgress(id);
        if (!p) return;
        setProgress(p);
        setStatus(p.status);
        if (!ACTIVE.has(p.status)) {
          stopPolling();
          router.refresh();
        }
      }, 3000);
    },
    [router, stopPolling, fetchProgress],
  );

  useEffect(() => {
    if (!runId || !status) return stopPolling;
    if (ACTIVE.has(status)) {
      poll(runId);
    } else if (!progress) {
      // completed run: fetch once so failed companies are visible + retriable
      fetchProgress(runId).then((p) => p && setProgress(p));
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, status]);

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

  async function retryFailed() {
    if (!runId) return;
    setError(null);
    const res = await fetch(`/api/runs/${runId}/retry-failed`, { method: "POST" });
    if (res.ok) {
      setStatus("running");
      setProgress(null);
      poll(runId);
    }
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

  const failedCount = progress?.failed ?? 0;
  const failedTitle =
    progress?.failedCompanies
      ?.map((f) => `${f.name}: ${f.error ?? "unknown error"}`)
      .join("\n") ?? "";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={startRun}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1 text-[11.5px] font-medium text-slate transition-colors hover:border-[#cdd4de] hover:text-ink"
        >
          <Play size={12} aria-hidden />
          {status ? "Re-run" : "Run analysis"}
        </button>
        {failedCount > 0 && (
          <button
            type="button"
            onClick={retryFailed}
            title={failedTitle}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-[#FBF0DA] px-2.5 py-1 text-[11.5px] font-semibold text-tier2 transition-colors hover:border-[#cdd4de]"
          >
            <RotateCcw size={12} aria-hidden />
            Retry {failedCount} failed
          </button>
        )}
      </div>
      {status === "halted_budget" && (
        <span className="text-[10.5px] font-semibold text-tier2">halted: budget cap</span>
      )}
      {error && <span className="max-w-[180px] text-[10.5px] text-spark">{error}</span>}
    </div>
  );
}
