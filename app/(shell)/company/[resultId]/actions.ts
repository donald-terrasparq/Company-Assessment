"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteCompany, findCompanyById } from "@/lib/db/queries/lists";
import {
  addNote,
  deleteNote,
  getNote,
  NOTE_MAX_CHARS,
  updateNoteBody,
} from "@/lib/db/queries/notes";

/**
 * Permanently delete a company from its list — cascades to every run result,
 * signal, contact, and drafted email for it. Reached only from the detail
 * page's danger zone after an explicit confirm.
 */
export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const id = z.string().uuid().safeParse(formData.get("company_id"));
  if (!id.success) return;
  const company = await findCompanyById(id.data);
  if (!company) return;

  await deleteCompany(company.id);
  revalidatePath("/prospects");
  redirect("/prospects");
}

const noteBody = z.string().trim().min(1).max(NOTE_MAX_CHARS);

/** Add a note to the company's shared thread (0015). */
export async function addNoteAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const companyId = z.string().uuid().safeParse(formData.get("company_id"));
  const body = noteBody.safeParse(formData.get("body"));
  if (!companyId.success || !body.success) return;
  if (!(await findCompanyById(companyId.data))) return;

  await addNote({
    companyId: companyId.data,
    body: body.data,
    createdBy: session.user.id ?? null,
  });
  revalidatePath(`/company/${formData.get("result_id")}`);
}

/** Edit your own note (admins may edit any). */
export async function updateNoteAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const noteId = z.string().uuid().safeParse(formData.get("note_id"));
  const body = noteBody.safeParse(formData.get("body"));
  if (!noteId.success || !body.success) return;

  const note = await getNote(noteId.data);
  if (!note) return;
  if (note.createdBy !== session.user.id && session.user.role !== "admin") return;

  await updateNoteBody(noteId.data, body.data);
  revalidatePath(`/company/${formData.get("result_id")}`);
}

/** Delete your own note (admins may delete any). */
export async function deleteNoteAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const noteId = z.string().uuid().safeParse(formData.get("note_id"));
  if (!noteId.success) return;

  const note = await getNote(noteId.data);
  if (!note) return;
  if (note.createdBy !== session.user.id && session.user.role !== "admin") return;

  await deleteNote(noteId.data);
  revalidatePath(`/company/${formData.get("result_id")}`);
}
