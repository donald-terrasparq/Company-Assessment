/**
 * Versioned migration runner. Runs locally via `npm run db:migrate` and on
 * every Render deploy via preDeployCommand (render.yaml).
 *
 * - Fresh database → applies db/schema.sql (the canonical full schema) and
 *   records every known migration version as applied.
 * - Existing database → applies any db/migrations/NNNN_*.sql not yet recorded
 *   in schema_migrations. (A DB created before schema_migrations existed is
 *   baselined at version 1 — that matches the schema.sql that shipped with
 *   Phase 0.)
 *
 * db/schema.sql must always equal "version 1 + every migration applied", so a
 * fresh DB and an upgraded DB end up identical.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { Client } from "pg";
import { loadEnvLocal } from "./env";

const MIGRATIONS_DIR = resolve(process.cwd(), "db/migrations");

function incrementalMigrations(): Array<{ version: number; file: string }> {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .map((f) => ({ version: Number(f.slice(0, 4)), file: join(MIGRATIONS_DIR, f) }))
    .sort((a, b) => a.version - b.version);
}

async function main() {
  loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "db:migrate: DATABASE_URL is not set. Locally, copy .env.example to .env.local and point it at a dev database.",
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version    INT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );

    const migrations = incrementalMigrations();
    const { rows: userTable } = await client.query(
      "SELECT to_regclass('public.users') AS t",
    );

    if (!userTable[0]?.t) {
      // Fresh database: schema.sql already contains every migration's end state.
      console.log("db:migrate: fresh database — applying db/schema.sql …");
      const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(schema);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT DO NOTHING",
        );
        for (const m of migrations) {
          await client.query(
            "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
            [m.version],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      console.log("db:migrate: done — schema created at latest version.");
      return;
    }

    // Existing database: baseline pre-runner DBs at version 1, then apply the rest.
    await client.query(
      "INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT DO NOTHING",
    );
    const { rows: appliedRows } = await client.query(
      "SELECT version FROM schema_migrations",
    );
    const applied = new Set(appliedRows.map((r) => Number(r.version)));

    let ran = 0;
    for (const m of migrations) {
      if (applied.has(m.version)) continue;
      console.log(`db:migrate: applying ${m.file.split("/").pop()} …`);
      await client.query("BEGIN");
      try {
        await client.query(readFileSync(m.file, "utf8"));
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [
          m.version,
        ]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      ran++;
    }
    console.log(
      ran === 0
        ? "db:migrate: up to date — nothing to apply."
        : `db:migrate: done — applied ${ran} migration(s).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("db:migrate: failed:", err);
  process.exit(1);
});
