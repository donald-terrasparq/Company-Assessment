import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// One pool per process; cached on globalThis so Next.js dev hot-reload doesn't
// leak connections. Render's internal DATABASE_URL needs no SSL config; Neon's
// carries ?sslmode=require in the URL itself.
const globalForDb = globalThis as unknown as { __caPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__caPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    globalForDb.__caPool = new Pool({ connectionString, max: 10 });
  }
  return globalForDb.__caPool;
}

export const db = drizzle({ client: getPool(), schema });
