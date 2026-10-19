import postgres from "postgres";
import type { Db } from "./types";

/**
 * The production adapter (Supabase through postgres.js). Kept separate from client.ts so the
 * tests can run the same code against a local Postgres-protocol server.
 *
 * Pass JSON parameters as `$n::text::jsonb`, never `$n::jsonb`: postgres.js JSON-encodes values
 * bound to a jsonb parameter, so an already-stringified value would arrive as a JSON string.
 */
export function postgresDb(url: string, options: postgres.Options<Record<string, postgres.PostgresType>> = {}) {
  // prepare: false is required for Supabase's transaction pooler
  const sql = postgres(url, { prepare: false, max: 5, ...options });
  const db: Db = { query: async (text, params = []) => (await sql.unsafe(text, params as never[])) as never };
  return { db, end: () => sql.end() };
}
