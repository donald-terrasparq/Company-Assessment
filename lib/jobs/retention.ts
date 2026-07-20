/**
 * Retention sweep (ticket 6.5): soft-delete runs older than
 * settings.retention_days and drop their signals — the bulky part. Lists and
 * companies are always kept. Runs daily from the worker loop (host-agnostic:
 * a Render Cron Job could call this instead without changes).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries/settings";

export async function runRetentionSweep(): Promise<{ runsDeleted: number; signalsDropped: number }> {
  const settings = await getSettings();
  const days = settings?.retentionDays ?? 365;

  const marked = await db.execute(sql`
    UPDATE runs SET deleted_at = now()
    WHERE deleted_at IS NULL
      AND created_at < now() - make_interval(days => ${days})
    RETURNING id
  `);
  const dropped = await db.execute(sql`
    DELETE FROM signals
    USING company_results cr, runs r
    WHERE signals.company_result_id = cr.id
      AND cr.run_id = r.id
      AND r.deleted_at IS NOT NULL
    RETURNING signals.id
  `);
  return { runsDeleted: marked.rows.length, signalsDropped: dropped.rows.length };
}
