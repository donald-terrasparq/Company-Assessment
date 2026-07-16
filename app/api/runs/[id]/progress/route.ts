import { auth } from "@/auth";
import { getRunProgress } from "@/lib/db/queries/runs";

/** GET /api/runs/:id/progress — the UI polls this every 3s during a run. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const progress = await getRunProgress(id);
  if (!progress) return Response.json({ error: "Run not found." }, { status: 404 });
  return Response.json(progress);
}
