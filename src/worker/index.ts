/**
 * Worker entrypoint — started by `npm run worker` (Render service
 * `company-assessment-worker`). Keep this thin: env, signals, then the driver.
 */
import { loadEnvLocal } from "../../scripts/env";

loadEnvLocal(); // local dev; on Render the real env vars already exist

if (!process.env.DATABASE_URL) {
  console.error("worker: DATABASE_URL is not set — cannot start");
  process.exit(1);
}

const controller = new AbortController();
process.on("SIGTERM", () => controller.abort()); // Render sends SIGTERM on deploy/scale-down
process.on("SIGINT", () => controller.abort());

import("../../lib/jobs/driver")
  .then(({ runRenderWorker }) => runRenderWorker(controller.signal))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("worker crashed:", err);
    process.exit(1);
  });
