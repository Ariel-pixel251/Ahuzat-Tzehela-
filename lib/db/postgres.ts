import pg from "pg";
import { logError } from "../log";
import type { Db } from "./types";

/** A query that takes longer than this fails (and its connection is closed) instead of hanging. */
export const QUERY_TIMEOUT_MS = 15_000;

export class DbTimeoutError extends Error {
  constructor() {
    super("database query timed out");
  }
}

export type PostgresOptions = {
  max?: number;
  /** false for a local server without TLS; production encrypts the connection. */
  ssl?: boolean;
  connectTimeoutMs?: number;
};

// dates as UTC midnight (as before the switch from postgres.js), whatever the server's time zone
const types = {
  getTypeParser: ((oid: number, format?: "text" | "binary") =>
    oid === pg.types.builtins.DATE ? (x: string) => new Date(x) : pg.types.getTypeParser(oid, format as "text")) as typeof pg.types.getTypeParser,
};

/**
 * The production adapter (Supabase through node-postgres). Kept separate from client.ts so the
 * tests can run the same code against a local Postgres-protocol server.
 *
 * node-postgres sends each query with its values in one go (parse, bind, execute, sync), which is
 * what Supabase's transaction pooler expects. (postgres.js first asked the server to describe the
 * parameters and waited for the answer; the pooler never passed that on, so every query with
 * values hung.)
 *
 * Pass JSON parameters as `$n::text::jsonb` with JSON.stringify(value).
 */
export function postgresDb(url: string, options: PostgresOptions = {}, timeoutMs = QUERY_TIMEOUT_MS) {
  const pool = new pg.Pool({
    connectionString: url,
    // Supabase's certificate is signed by its own authority: encrypt, without checking the chain
    ssl: options.ssl === false ? false : { rejectUnauthorized: false },
    max: options.max ?? 5,
    connectionTimeoutMillis: options.connectTimeoutMs ?? 10_000,
    // on Vercel a paused function can come back with connections the pooler already dropped:
    // close idle ones early and renew them often
    idleTimeoutMillis: 20_000,
    maxLifetimeSeconds: 300,
    types,
  });
  // a dropped idle connection must not crash the server; the pool replaces it
  pool.on("error", (err) => logError("db: idle connection closed", err));

  const db: Db = {
    query: async (text, params = []) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DbTimeoutError()), timeoutMs);
      });
      const connecting = pool.connect();
      let client: pg.PoolClient | undefined;
      try {
        client = await Promise.race([connecting, timeout]);
        // query(text, params) sends the values separately from the text. The text itself is
        // always a constant (see eslint.config.mjs).
        const result = await Promise.race([client.query(text, params as unknown[]), timeout]);
        client.release();
        return result.rows as never;
      } catch (err) {
        if (client) {
          // true: close this connection rather than reuse it (it may be stuck)
          client.release(err instanceof DbTimeoutError ? true : undefined);
        } else {
          // a connection that arrives after the timeout goes straight back to the pool
          connecting.then((c) => c.release(), () => {});
        }
        if (err instanceof DbTimeoutError) logError("db: no answer in time", err);
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
  };
  return { db, end: () => pool.end() };
}
