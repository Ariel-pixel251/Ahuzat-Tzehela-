import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "@/lib/db/migrate";
import type { Db } from "@/lib/db/types";

let template: Promise<Blob | File> | undefined;

/**
 * A fresh in-memory Postgres with all migrations applied (cloned from a migrated template).
 * Supabase's public API roles (anon, authenticated) are created first, so the migration's
 * lock-down runs exactly as on Supabase and the tests can prove what those roles can't do.
 */
export async function testDb(): Promise<Db & { pg: PGlite }> {
  template ??= (async () => {
    const pg = new PGlite();
    await pg.exec("create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;");
    await applyMigrations(pg);
    const dump = await pg.dumpDataDir("none");
    await pg.close();
    return dump;
  })();
  const pg = new PGlite({ loadDataDir: await template });
  return { pg, query: async (text, params) => (await pg.query(text, params)).rows as never };
}
