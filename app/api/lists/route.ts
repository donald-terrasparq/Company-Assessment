import { auth } from "@/auth";
import {
  buildDisplayName,
  dedupeRows,
  validateListPayload,
  MAX_UPLOAD_BYTES,
} from "@/lib/lists/validate";
import { createListWithCompanies } from "@/lib/db/queries/lists";
import { saveRawUpload } from "@/lib/storage/files";

/**
 * POST /api/lists — multipart form: `payload` (JSON string: name, filename,
 * rows[]) + optional `file` (the raw spreadsheet, kept for audit).
 * The 100-company cap 422s here even if the client is bypassed (rule 9);
 * the DB CHECK is the third layer.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let payloadRaw: unknown;
  let file: File | null = null;
  try {
    const form = await request.formData();
    payloadRaw = JSON.parse(String(form.get("payload") ?? "null"));
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: "Malformed upload request." }, { status: 400 });
  }

  const validated = validateListPayload(payloadRaw);
  if (!validated.ok) {
    return Response.json({ error: validated.message }, { status: validated.status });
  }
  if (file && file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "File exceeds the 5 MB limit." }, { status: 422 });
  }

  const { payload } = validated;
  const deduped = dedupeRows(payload.rows);
  if (deduped.rows.length === 0) {
    return Response.json({ error: "No usable company rows after dedupe." }, { status: 422 });
  }

  const list = await createListWithCompanies({
    name: payload.name,
    displayName: buildDisplayName(payload.name, new Date()),
    uploadedBy: session.user.id,
    sourceFilename: payload.filename,
    blobUrl: null,
    rows: deduped.rows.map((r, i) => ({
      name: r.name,
      website: r.website,
      domain: r.domain,
      rawRow: deduped.rawByIndex[i] ?? {},
    })),
  });

  // best-effort raw-file retention; never blocks the upload
  if (file) {
    await saveRawUpload(list.id, payload.filename, Buffer.from(await file.arrayBuffer()));
  }

  return Response.json(
    {
      list_id: list.id,
      display_name: list.displayName,
      company_count: deduped.rows.length,
      duplicates_removed: deduped.duplicatesRemoved,
      unparseable_urls: deduped.unparseableUrls,
    },
    { status: 201 },
  );
}
