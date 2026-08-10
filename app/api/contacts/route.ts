import { z } from "zod";
import { auth } from "@/auth";
import { findCompanyById } from "@/lib/db/queries/lists";
import {
  addManualContact,
  deleteManualContact,
  findOverrideByName,
  getManualContact,
  listManualContactsForCompany,
  updateManualContact,
} from "@/lib/db/queries/manual-contacts";
import { manualDisplayName } from "@/lib/contacts/merge";

/**
 * Manual contacts (0015): user-entered contacts and corrections to auto-found
 * ones. Rows are keyed on the company (not the per-run result), so they
 * survive re-analysis. POST creates (or upserts a correction), PATCH edits,
 * DELETE removes — deleting a correction reverts the auto-found contact to
 * its researched data.
 */

const short = z.string().trim().max(120);
const optionalShort = short.max(120).transform((v) => (v === "" ? null : v)).nullish();

const CreateSchema = z.object({
  company_id: z.string().uuid(),
  first_name: short.min(1),
  last_name: optionalShort,
  title: optionalShort,
  email: z.union([z.literal(""), z.string().trim().email().max(200)]).nullish(),
  phone: optionalShort,
  /** Set when this row corrects an auto-found contact with that name. */
  overrides_name: optionalShort,
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  first_name: short.min(1),
  last_name: optionalShort,
  title: optionalShort,
  email: z.union([z.literal(""), z.string().trim().email().max(200)]).nullish(),
  phone: optionalShort,
});

const DeleteSchema = z.object({ id: z.string().uuid() });

const nullIfEmpty = (v: string | null | undefined) => (v ? v : null);

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Not signed in." }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid contact — a first name is required." }, { status: 400 });
  }
  const b = parsed.data;
  if (!(await findCompanyById(b.company_id))) {
    return Response.json({ error: "Company not found." }, { status: 404 });
  }

  const fields = {
    firstName: b.first_name,
    lastName: nullIfEmpty(b.last_name),
    title: nullIfEmpty(b.title),
    email: nullIfEmpty(b.email),
    phone: nullIfEmpty(b.phone),
  };

  // correction upsert: one override row per auto-found name
  if (b.overrides_name) {
    const existing = await findOverrideByName(b.company_id, b.overrides_name);
    if (existing) {
      await updateManualContact(existing.id, fields);
      return Response.json({ id: existing.id });
    }
  }

  const row = await addManualContact({
    companyId: b.company_id,
    ...fields,
    overridesName: nullIfEmpty(b.overrides_name),
    createdBy: session.user.id,
  });
  return Response.json({ id: row.id, name: manualDisplayName(row) });
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Not signed in." }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid contact — a first name is required." }, { status: 400 });
  }
  const b = parsed.data;
  if (!(await getManualContact(b.id))) {
    return Response.json({ error: "Contact not found." }, { status: 404 });
  }

  await updateManualContact(b.id, {
    firstName: b.first_name,
    lastName: nullIfEmpty(b.last_name),
    title: nullIfEmpty(b.title),
    email: nullIfEmpty(b.email),
    phone: nullIfEmpty(b.phone),
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Not signed in." }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const row = await getManualContact(parsed.data.id);
  if (!row) return Response.json({ error: "Contact not found." }, { status: 404 });

  await deleteManualContact(row.id);
  return Response.json({ ok: true, reverted: row.overridesName != null });
}

/** Convenience for tooling/tests: list a company's manual contacts. */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Not signed in." }, { status: 401 });
  const companyId = new URL(request.url).searchParams.get("company_id");
  const parsed = z.string().uuid().safeParse(companyId);
  if (!parsed.success) return Response.json({ error: "company_id required." }, { status: 400 });
  return Response.json({ contacts: await listManualContactsForCompany(parsed.data) });
}
