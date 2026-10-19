import "server-only";
import { DbNotConfiguredError, type Db } from "./types";

const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

/**
 * Production: Supabase Postgres via DATABASE_URL.
 * Development without DATABASE_URL: a local PGlite database in .data/pglite, migrated automatically.
 */
export function getDb(): Promise<Db> {
  globalForDb.__db ??= connect().catch((err) => {
    // don't cache a failed connection
    globalForDb.__db = undefined;
    throw err;
  });
  return globalForDb.__db;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    // prepare: false is required for Supabase's transaction pooler
    const sql = postgres(url, { prepare: false, max: 5 });
    return { query: async (text, params = []) => (await sql.unsafe(text, params as never[])) as never };
  }
  if (process.env.NODE_ENV === "production") throw new DbNotConfiguredError();
  const { PGlite } = await import("@electric-sql/pglite");
  const { applyMigrations } = await import("./migrate");
  const { mkdir } = await import("node:fs/promises");
  const dir = process.env.PGLITE_DIR || ".data/pglite";
  await mkdir(dir, { recursive: true });
  const pg = new PGlite(dir);
  await applyMigrations(pg, { seed: true });
  console.info(`[db] DATABASE_URL not set: using the local PGlite database in ${dir}`);
  return { query: async (text, params) => (await pg.query(text, params)).rows as never };
}
