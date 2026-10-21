import postgres from "postgres";
import { logError } from "../log";
import type { Db } from "./types";

/** A query that takes longer than this fails (and the connections are reopened) instead of hanging. */
export const QUERY_TIMEOUT_MS = 15_000;

export class DbTimeoutError extends Error {
  constructor() {
    super("database query timed out");
  }
}

/**
 * The production adapter (Supabase through postgres.js). Kept separate from client.ts so the
 * tests can run the same code against a local Postgres-protocol server.
 *
 * Pass JSON parameters as `$n::text::jsonb`, never `$n::jsonb`: postgres.js JSON-encodes values
 * bound to a jsonb parameter, so an already-stringified value would arrive as a JSON string.
 */
export function postgresDb(
  url: string,
  options: postgres.Options<Record<string, postgres.PostgresType>> = {},
  timeoutMs = QUERY_TIMEOUT_MS,
) {
  // prepare: false is required for Supabase's transaction pooler. On Vercel a paused function can
  // come back with connections the pooler already dropped: close idle ones early and renew them often.
  const open = () => postgres(url, { prepare: false, max: 5, connect_timeout: 10, idle_timeout: 20, max_lifetime: 300, ...options });
  let sql = open();
  // unsafe(text, params) is postgres.js's call for a query with bind parameters ($1, $2…): the values
  // are sent separately from the text. The text itself is always a constant (see eslint.config.mjs).
  const db: Db = {
    query: async (text, params = []) => {
      const current = sql;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DbTimeoutError()), timeoutMs);
      });
      try {
        return (await Promise.race([current.unsafe(text, params as never[]), timeout])) as never;
      } catch (err) {
        if (err instanceof DbTimeoutError && sql === current) {
          // a stuck connection: start over with fresh ones for the next request
          logError("db: no answer in time, reconnecting", err);
          sql = open();
          void current.end({ timeout: 0 }).catch(() => {});
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
  };
  return { db, end: () => sql.end() };
}
