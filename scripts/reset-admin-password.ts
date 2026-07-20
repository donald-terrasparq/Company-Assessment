/**
 * Force-reset the admin password to the current SEED_ADMIN_PASSWORD env value.
 * Unlike db:seed (which never touches an existing user), this OVERWRITES the
 * password for SEED_ADMIN_USER. Use when the admin password is lost:
 *   1. Set/confirm SEED_ADMIN_USER + SEED_ADMIN_PASSWORD on the web service.
 *   2. Shell → npm run db:reset-admin
 *   3. Log in and change the password in Settings → Account.
 */
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { loadEnvLocal } from "./env";

async function main() {
  loadEnvLocal();
  const { DATABASE_URL, SEED_ADMIN_USER, SEED_ADMIN_PASSWORD } = process.env;
  if (!DATABASE_URL || !SEED_ADMIN_USER || !SEED_ADMIN_PASSWORD) {
    console.error(
      "db:reset-admin: DATABASE_URL, SEED_ADMIN_USER and SEED_ADMIN_PASSWORD must all be set.",
    );
    process.exit(1);
  }
  if (SEED_ADMIN_PASSWORD.length < 8) {
    console.error("db:reset-admin: SEED_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const hash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
    const res = await client.query(
      `UPDATE users SET password_hash = $1, is_active = TRUE, role = 'admin'
       WHERE username = $2 RETURNING id`,
      [hash, SEED_ADMIN_USER],
    );
    if (res.rowCount === 0) {
      console.error(
        `db:reset-admin: no user named "${SEED_ADMIN_USER}" — run npm run db:seed first.`,
      );
      process.exit(1);
    }
    console.log(
      `db:reset-admin: password for "${SEED_ADMIN_USER}" reset to the SEED_ADMIN_PASSWORD value. ` +
        "Change it in Settings → Account after logging in.",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("db:reset-admin: failed:", err);
  process.exit(1);
});
