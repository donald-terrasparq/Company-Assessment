/**
 * Seeds the admin user (SEED_ADMIN_USER / SEED_ADMIN_PASSWORD), the default
 * signal profile (docs/03-SIGNAL-MODEL.md), and the settings row (id = 1).
 *
 * The seed content is Phase 1 ticket 1.3 (docs/05-BUILD-PLAN.md); Phase 0 only
 * wires the script. It validates its inputs and exits cleanly so `npm run
 * db:seed` is safe to call today.
 */
import { loadEnvLocal } from "./env";

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error("db:seed: DATABASE_URL is not set.");
    process.exit(1);
  }
  console.log(
    "db:seed: not implemented yet — admin user, default signal profile, and settings row land in Phase 1 (ticket 1.3).",
  );
}

main().catch((err) => {
  console.error("db:seed: failed:", err);
  process.exit(1);
});
