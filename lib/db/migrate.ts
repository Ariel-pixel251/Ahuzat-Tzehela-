import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SUPABASE_DIR = path.join(process.cwd(), "supabase");

type Exec = { exec(sql: string): Promise<unknown>; query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> };

/**
 * Applies supabase/migrations/*.sql in order to a PGlite database (local dev and tests).
 * With `seed`, also runs supabase/seed.sql the first time the database is created.
 */
export async function applyMigrations(db: Exec, { seed = false } = {}) {
  await db.exec("create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())");
  const applied = new Set(
    ((await db.query("select name from schema_migrations")).rows as { name: string }[]).map((r) => r.name),
  );
  const fresh = applied.size === 0;
  const dir = path.join(SUPABASE_DIR, "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.exec(`begin;\n${await readFile(path.join(dir, file), "utf8")}\ncommit;`);
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  if (seed && fresh) await db.exec(await readFile(path.join(SUPABASE_DIR, "seed.sql"), "utf8"));
}
