/**
 * Applies db/schema.sql. Runs locally via `npm run db:migrate` and on every
 * Render deploy via preDeployCommand (render.yaml).
 *
 * Phase 0 strategy: schema.sql is a full CREATE of the initial schema, so this
 * checks for the `users` table and skips if it already exists. When the schema
 * starts evolving (post-launch), replace this with real versioned migrations.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { loadEnvLocal } from "./env";

async function main() {
  loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "db:migrate: DATABASE_URL is not set. Locally, copy .env.example to .env.local and point it at a Neon dev branch.",
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT to_regclass('public.users') AS users_table",
    );
    if (rows[0]?.users_table) {
      console.log("db:migrate: schema already applied — nothing to do.");
      return;
    }

    const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
    console.log("db:migrate: applying db/schema.sql …");
    await client.query("BEGIN");
    try {
      await client.query(schema);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
    console.log("db:migrate: done — all tables, indexes, and views created.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("db:migrate: failed:", err);
  process.exit(1);
});
