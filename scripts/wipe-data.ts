/**
 * Erase all ANALYSIS data for a clean slate: lists, companies, runs, jobs,
 * results, signals, contacts, and API-usage/spend records. Users, settings,
 * invites, and the signal weight profile are KEPT.
 *
 * Deliberately requires --yes:  npm run db:wipe -- --yes
 * (Render: web service → Shell → same command.)
 */
import { Client } from "pg";
import { loadEnvLocal } from "./env";

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error("db:wipe: DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!process.argv.includes("--yes")) {
    console.error(
      "db:wipe: refusing to run without --yes.\n" +
        "This erases ALL lists, companies, runs, results, signals, contacts and spend records\n" +
        "(users, settings and signal weights are kept). Run: npm run db:wipe -- --yes",
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // lists cascade → companies → runs → jobs/company_results → signals/contacts
    const lists = await client.query("DELETE FROM lists RETURNING id");
    const usage = await client.query("DELETE FROM api_usage RETURNING id");
    console.log(
      `db:wipe: done — ${lists.rowCount} list(s) and all their runs/results/signals removed, ` +
        `${usage.rowCount} usage record(s) cleared. Users, settings and weights kept.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("db:wipe: failed:", err);
  process.exit(1);
});
