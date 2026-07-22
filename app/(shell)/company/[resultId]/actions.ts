"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteCompany, findCompanyById } from "@/lib/db/queries/lists";

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
