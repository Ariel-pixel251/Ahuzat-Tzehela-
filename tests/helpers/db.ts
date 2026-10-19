import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "@/lib/db/migrate";
import type { Db } from "@/lib/db/types";

let template: Promise<Blob | File> | undefined;

/** A fresh in-memory Postgres with all migrations applied (cloned from a migrated template). */
export async function testDb(): Promise<Db & { pg: PGlite }> {
  template ??= (async () => {
    const pg = new PGlite();
    await applyMigrations(pg, { seed: true });
    const dump = await pg.dumpDataDir("none");
    await pg.close();
    return dump;
  })();
  const pg = new PGlite({ loadDataDir: await template });
  return { pg, query: async (text, params) => (await pg.query(text, params)).rows as never };
}
