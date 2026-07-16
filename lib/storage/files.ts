/**
 * Raw upload storage (docs/00-PRD.md: keep the original spreadsheet for
 * audit/re-run). Local-disk driver: UPLOAD_DIR or ./uploads. On Render this
 * is ephemeral unless a Persistent Disk is attached to the web service; an
 * S3-compatible driver can replace this without touching callers. Losing a
 * raw file never breaks scoring — it's an audit artifact.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? resolve(process.cwd(), "uploads");
}

export async function saveRawUpload(
  listId: string,
  filename: string,
  bytes: Buffer,
): Promise<string | null> {
  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const path = join(dir, `${listId}__${safeName}`);
    await writeFile(path, bytes);
    return path;
  } catch (err) {
    console.error("storage: failed to save raw upload (non-fatal):", err);
    return null;
  }
}
