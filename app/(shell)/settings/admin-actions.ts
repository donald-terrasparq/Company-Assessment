"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { updateSettings } from "@/lib/db/queries/settings";
import { BALANCED_MODEL, HIGH_ACCURACY_MODEL } from "@/lib/anthropic/models";

/** Every Phase 6 settings mutation is admin-only — re-checked server-side. */
async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function updateModelAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const mode = z.enum(["balanced", "high_accuracy"]).catch("balanced").parse(formData.get("mode"));
  await updateSettings({ model: mode === "high_accuracy" ? HIGH_ACCURACY_MODEL : BALANCED_MODEL });
  revalidatePath("/settings/analysis");
}

export async function updateEscalationAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const parsed = z.coerce.number().safeParse(formData.get("pct"));
  if (!parsed.success || ![0, 20, 40, 60, 80, 100].includes(parsed.data)) return;
  await updateSettings({ escalationPct: parsed.data });
  revalidatePath("/settings/analysis");
}

export async function updateProviderAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const provider = z
    .enum(["brave", "google_cse", "anthropic"])
    .catch("brave")
    .parse(formData.get("provider"));
  await updateSettings({ searchProvider: provider });
  revalidatePath("/settings/data-sources");
}

export async function updateApolloAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  await updateSettings({ apolloEnabled: formData.get("enabled") === "on" });
  revalidatePath("/settings/data-sources");
}

export async function updateContactDefaultsAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const { parseContactPrefs } = await import("@/lib/apollo/prefs");
  const prefs = parseContactPrefs({
    seniorities: formData.getAll("seniorities").map(String),
    departments: formData.getAll("departments").map(String),
    titles: String(formData.get("titles") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  await updateSettings({ contactDefaults: prefs });
  revalidatePath("/settings/contacts");
}

export async function updateBudgetAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  // preset chip (if one was clicked) wins over the custom input
  const raw = formData.get("preset") ?? formData.get("budget");
  const parsed = z.coerce.number().min(1).max(100000).safeParse(raw);
  if (!parsed.success) return;
  await updateSettings({ monthlyBudgetUsd: parsed.data.toFixed(2) });
  revalidatePath("/settings/budget");
}

export async function updateRetentionAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const parsed = z.coerce.number().int().min(30).max(3650).safeParse(formData.get("days"));
  if (!parsed.success) return;
  await updateSettings({ retentionDays: parsed.data });
  revalidatePath("/settings/retention");
}

export async function saveCompanyProfileAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const { parseCompanyProfile, PRODUCT_SLOTS } = await import("@/lib/company/profile");
  const { updateProfile } = await import("@/lib/db/queries/company-profiles");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const profile = parseCompanyProfile({
    name: formData.get("name"),
    website: formData.get("website"),
    industry: formData.get("industry"),
    products: PRODUCT_SLOTS.map((slot, i) => ({
      slot,
      label: formData.get(`product_label_${i}`),
      description: formData.get(`product_desc_${i}`),
    })),
    aiContext: {
      companyDescription: formData.get("company_description"),
      signalGuidance: formData.get("signal_guidance"),
      searchKeywords: formData.get("search_keywords"),
    },
  });
  await updateProfile(id.data, profile);
  revalidatePath("/settings/company");
}

export async function addCompanyProfileAction(): Promise<void> {
  if (!(await requireAdmin())) return;
  const { CTS_PROFILE } = await import("@/lib/company/profile");
  const { createProfile } = await import("@/lib/db/queries/company-profiles");
  // new profiles start as a copy of the CTS template to edit, inactive
  const id = await createProfile({ ...CTS_PROFILE, name: "New company profile" });
  revalidatePath("/settings/company");
  const { redirect } = await import("next/navigation");
  redirect(`/settings/company?profile=${id}`);
}

export async function activateCompanyProfileAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const { setActiveProfile } = await import("@/lib/db/queries/company-profiles");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await setActiveProfile(id.data);
  revalidatePath("/settings/company");
}

export async function deactivateCompanyProfileAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const { deactivateProfile } = await import("@/lib/db/queries/company-profiles");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await deactivateProfile(id.data);
  revalidatePath("/settings/company");
}

export async function deleteCompanyProfileAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const { deleteProfile } = await import("@/lib/db/queries/company-profiles");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await deleteProfile(id.data);
  revalidatePath("/settings/company");
  const { redirect } = await import("next/navigation");
  redirect("/settings/company");
}
