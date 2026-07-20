"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

/**
 * Streams rows in during a run: polls progress every 3s, refreshes the server
 * component so finished companies appear, and renders the live pill with
 * elapsed time and the estimated time remaining.
 */
export function RefreshWhileRunning({ runId }: { runId: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/progress`);
        if (!res.ok) return;
        const p = (await res.json()) as Progress;
        setProgress(p);
        router.refresh();
        if (!["queued", "running"].includes(p.status) && timer.current) {
          clearInterval(timer.current);
        }
      } catch {
        // transient
      }
    }, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [runId, router]);

  const done = (progress?.done ?? 0) + (progress?.failed ?? 0);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-spark-soft px-3 py-1 text-[11.5px] font-bold text-spark">
      <span className="h-[6px] w-[6px] animate-spark-pulse rounded-full bg-spark" />
      {progress
        ? `analyzing — ${done} of ${progress.total}` +
          (progress.elapsedSeconds ? ` · ${fmtDuration(progress.elapsedSeconds)}` : "") +
          (progress.estRemainingSeconds != null
            ? ` · ~${fmtDuration(progress.estRemainingSeconds)} left`
            : "") +
          (progress.phase === "second_pass" ? " · 2nd pass" : "")
        : "analyzing — rows stream in as companies finish"}
    </span>
  );
}
