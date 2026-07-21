import { z } from "zod";
import { auth } from "@/auth";
import { draftEmail } from "@/lib/anthropic/email";
import { normalizePlaySteps } from "@/lib/anthropic/extract";
import { EMAIL_STYLES } from "@/lib/email-styles";
import { getResultDetail } from "@/lib/db/queries/prospects";
import { getSettings } from "@/lib/db/queries/settings";
import { logUsage, monthToDateCostUsd } from "@/lib/db/queries/usage";

const BodySchema = z.object({
  result_id: z.string().uuid(),
  play_index: z.number().int().min(0),
  contact_id: z.string().uuid().nullable(),
  style_key: z.string(),
});

/**
 * POST /api/email — draft one outreach email for the Draft Email modal.
 * The play text and contact are re-derived server-side from the stored
 * result, so the prompt only ever contains facts we researched (hard rule 3);
 * the client picks indices, never free text. One short model call — quick
 * enough to answer inline, so this is a request, not a job.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { result_id, play_index, contact_id, style_key } = parsed.data;

  if (!EMAIL_STYLES.some((s) => s.key === style_key)) {
    return Response.json({ error: "Unknown style." }, { status: 422 });
  }

  const detail = await getResultDetail(result_id);
  if (!detail) return Response.json({ error: "Result not found." }, { status: 404 });
  const { result, company, signals, contacts } = detail;

  const playSteps = normalizePlaySteps(result.recommendedPlay ?? "");
  const play = playSteps[play_index];
  if (!play) {
    return Response.json({ error: "No such recommended-play step." }, { status: 422 });
  }

  let contact: { name: string; title: string | null } | null = null;
  if (contact_id) {
    const row = contacts.find((c) => c.id === contact_id);
    if (!row) return Response.json({ error: "Contact not found." }, { status: 422 });
    contact = { name: row.name, title: row.title };
  }

  // budget cap (hard rule 6): even one email call counts against the month
  const settings = await getSettings();
  if (!settings) {
    return Response.json({ error: "Settings not seeded — run db:seed." }, { status: 500 });
  }
  if ((await monthToDateCostUsd()) >= Number(settings.monthlyBudgetUsd)) {
    return Response.json(
      { error: `Monthly budget cap ($${settings.monthlyBudgetUsd}) reached.` },
      { status: 402 },
    );
  }

  const topSignals = [...signals]
    .sort((a, b) => Number(b.pointsAwarded) - Number(a.pointsAwarded))
    .slice(0, 6)
    .map((s) => ({ title: s.title, date: s.eventDate, sourceName: s.sourceName }));

  try {
    const drafted = await draftEmail({
      companyName: company.name,
      domain: company.domain,
      industry: result.industry,
      hq: result.hq,
      whyNow: result.whyNow,
      play,
      contact,
      styleKey: style_key,
      signals: topSignals,
    });

    await logUsage({
      runId: result.runId,
      companyId: company.id,
      provider: "anthropic",
      inputTokens: drafted.inputTokens,
      outputTokens: drafted.outputTokens,
      costUsd: drafted.costUsd,
    });

    return Response.json({ subject: drafted.subject, body: drafted.body });
  } catch {
    return Response.json(
      { error: "Drafting failed — try again in a moment." },
      { status: 502 },
    );
  }
}
