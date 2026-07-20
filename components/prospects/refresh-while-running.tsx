"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Streams rows in during a run: polls progress every 3s and refreshes the
 * server component so finished companies appear as their jobs complete.
 */
export function RefreshWhileRunning({ runId }: { runId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/progress`);
        if (!res.ok) return;
        const p = await res.json();
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

  return null;
}
