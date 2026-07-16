// Render's health check hits this (render.yaml healthCheckPath).
// Deliberately shallow: it must not ping the worker or the Anthropic API —
// a transient upstream hiccup should never make Render restart the web service.
export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
