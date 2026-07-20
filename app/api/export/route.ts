import { auth } from "@/auth";
import { allProspects, prospectsForList } from "@/lib/db/queries/prospects";
import { applyFilters, prospectsToCsv } from "@/lib/export/csv";

/**
 * GET /api/export?list=<id|all>&tiers=..&categories=..&fresh=1&hide_caveats=1
 * Server-generated CSV honoring the active filters (ticket 4.5).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const url = new URL(request.url);
  const listParam = url.searchParams.get("list") ?? "all";

  const rows =
    listParam === "all" ? await allProspects() : await prospectsForList(listParam);

  const filtered = applyFilters(rows, {
    tiers: url.searchParams.get("tiers")?.split(",").filter(Boolean) ?? [],
    categories: url.searchParams.get("categories")?.split(",").filter(Boolean) ?? [],
    freshOnly: url.searchParams.get("fresh") === "1",
    hideCaveats: url.searchParams.get("hide_caveats") === "1",
  });
  filtered.sort((a, b) => b.totalScore - a.totalScore);

  const date = new Date().toISOString().slice(0, 10);
  return new Response(prospectsToCsv(filtered), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prospects-${listParam}-${date}.csv"`,
    },
  });
}
