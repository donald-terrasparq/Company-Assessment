/**
 * Seed (ticket 1.3): the admin account from SEED_ADMIN_USER / SEED_ADMIN_PASSWORD,
 * the settings row (id = 1), and the Default signal profile from
 * docs/03-SIGNAL-MODEL.md. Idempotent — safe to run more than once.
 *
 * Render: run once from the company-assessment-web Shell → `npm run db:seed`.
 */
import bcrypt from "bcryptjs";
import { loadEnvLocal } from "./env";

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error("db:seed: DATABASE_URL is not set.");
    process.exit(1);
  }

  // imported after env is loaded so lib/db/client.ts sees DATABASE_URL
  const { findUserByUsername, createUser } = await import("../lib/db/queries/users");
  const { ensureSettingsRow } = await import("../lib/db/queries/settings");
  const { getDefaultProfile, createDefaultProfile } = await import(
    "../lib/db/queries/profiles"
  );
  const { DEFAULT_WEIGHTS } = await import("../lib/scoring/default-weights");

  const username = process.env.SEED_ADMIN_USER;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    console.error("db:seed: SEED_ADMIN_USER and SEED_ADMIN_PASSWORD must be set.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("db:seed: SEED_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const settingsResult = await ensureSettingsRow();
  console.log(
    settingsResult.created
      ? "db:seed: created settings row (id = 1)"
      : "db:seed: settings row already exists",
  );

  if (await getDefaultProfile()) {
    console.log("db:seed: default signal profile already exists");
  } else {
    await createDefaultProfile(DEFAULT_WEIGHTS);
    console.log("created default signal profile");
  }

  if (await findUserByUsername(username)) {
    console.log(`db:seed: user "${username}" already exists — password unchanged`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await createUser({ username, passwordHash, role: "admin" });
    console.log(`created admin user "${username}"`);
  }

  console.log("db:seed: done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("db:seed: failed:", err);
  process.exit(1);
});
