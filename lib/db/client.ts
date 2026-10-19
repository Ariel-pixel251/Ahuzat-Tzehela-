import "server-only";
import { readEnv } from "../env";
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

/** "postgres": Supabase via DATABASE_URL; "local": PGlite (development); "missing": production without DATABASE_URL. */
export function databaseMode(): "postgres" | "local" | "missing" {
  if (readEnv("DATABASE_URL")) return "postgres";
  return process.env.NODE_ENV === "production" ? "missing" : "local";
}

async function connect(): Promise<Db> {
  const mode = databaseMode();
  if (mode === "postgres") {
    const { postgresDb } = await import("./postgres");
    return postgresDb(readEnv("DATABASE_URL")!).db;
  }
  if (mode === "missing") throw new DbNotConfiguredError();
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
