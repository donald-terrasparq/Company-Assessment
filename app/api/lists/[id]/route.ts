import { auth } from "@/auth";
import { findListById, softDeleteList } from "@/lib/db/queries/lists";

/** DELETE /api/lists/:id — soft delete (docs/05 ticket 2.5). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const list = await findListById(id);
  if (!list) return Response.json({ error: "List not found." }, { status: 404 });
  await softDeleteList(id);
  return Response.json({ ok: true });
}
