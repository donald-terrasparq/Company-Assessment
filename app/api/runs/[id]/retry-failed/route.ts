import { auth } from "@/auth";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { findRunById } from "@/lib/db/queries/runs";

/**
 * POST /api/runs/:id/retry-failed — re-open every failed job in the run with
 * fresh attempts (keeping its pass/model override) so the worker finishes the
 * companies that errored out. The run resumes and completes normally.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const run = await findRunById(id);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  const reopened = await db.execute(sql`
    UPDATE jobs
    SET status = 'pending', attempts = 0, locked_at = NULL, updated_at = now()
    WHERE run_id = ${id} AND status = 'failed'
    RETURNING id
  `);
  if (reopened.rows.length > 0) {
    await db.execute(sql`
      UPDATE runs SET status = 'running', finished_at = NULL WHERE id = ${id}
    `);
  }
  return Response.json({ ok: true, retried: reopened.rows.length });
}
