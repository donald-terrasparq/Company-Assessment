# Vercel — alternate host (not the default)

Company Assessment deploys to **Render** by default (`/render.yaml`, `docs/09-DEPLOY-RENDER.md`). This folder keeps
the Vercel path alive in case you ever want the UI on Vercel's edge network.

To use it:
1. Move `vercel.json` to the repo root.
2. Implement the Vercel driver in `lib/jobs/driver.ts`: a `POST /api/cron/worker` route that claims
   jobs, processes them, and **stops claiming at T-45s** so it finishes before the function's
   `maxDuration` (300s Hobby / 800s Pro with fluid compute).
3. Protect that route with `Authorization: Bearer $CRON_SECRET`.
4. Enable fluid compute on the project and set `maxDuration` on the worker route.
5. Add `CRON_SECRET` to the env.

Everything else — schema, `lib/scoring/`, the UI — is identical to the Render build. See
`docs/08-HOSTING.md` for the trade-offs.
