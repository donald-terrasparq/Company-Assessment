/**
 * Worker entrypoint — started by `npm run worker` (Render service `company-assessment-worker`).
 * Keep this thin: wire signals, then hand off to the driver.
 */
import { runRenderWorker } from "../../lib/jobs/driver";

const controller = new AbortController();
process.on("SIGTERM", () => controller.abort());  // Render sends SIGTERM on deploy/scale-down
process.on("SIGINT", () => controller.abort());

runRenderWorker(controller.signal)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("worker crashed:", err);
    process.exit(1);
  });
