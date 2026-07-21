import { auth } from "@/auth";
import {
  ApolloError,
  apolloKeyFingerprint,
  apolloKeySource,
  isApolloConfigured,
} from "@/lib/apollo/client";
import { apolloGet } from "@/lib/apollo/client";

/**
 * GET /api/apollo/health — admin-only connection test for the Data sources
 * tab. Calls Apollo's free auth/health endpoint and reports which env var
 * supplied the key plus a safe fingerprint (first/last 4 chars) so a bad
 * paste can be spotted without ever exposing the key.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Admin only." }, { status: 403 });
  }
  if (!isApolloConfigured()) {
    return Response.json({
      ok: false,
      detail: "No key found — set the APOLLO env var on the Render web service.",
      keySource: null,
      keyFingerprint: null,
    });
  }

  const keySource = apolloKeySource();
  const keyFingerprint = apolloKeyFingerprint();
  try {
    const health = await apolloGet<{ healthy?: boolean; is_logged_in?: boolean }>(
      "/auth/health",
      {},
    );
    return Response.json({
      ok: health.is_logged_in === true || health.healthy === true,
      detail:
        health.is_logged_in === true || health.healthy === true
          ? "Apollo accepted the key."
          : `Apollo answered but did not confirm the key: ${JSON.stringify(health).slice(0, 120)}`,
      keySource,
      keyFingerprint,
    });
  } catch (err) {
    const status = err instanceof ApolloError ? err.status : null;
    const body = err instanceof ApolloError ? err.body.slice(0, 160) : String(err).slice(0, 160);
    return Response.json({
      ok: false,
      detail:
        status === 401
          ? `Apollo returned 401 — the key VALUE is wrong (not a scope/plan issue). Apollo said: ${body}`
          : `Apollo health check failed (${status ?? "network"}): ${body}`,
      keySource,
      keyFingerprint,
    });
  }
}
