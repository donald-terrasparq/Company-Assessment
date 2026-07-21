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
