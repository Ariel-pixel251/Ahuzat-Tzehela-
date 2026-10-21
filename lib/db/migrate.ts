import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

type Exec = { exec(sql: string): Promise<unknown>; query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> };

/** Applies supabase/migrations/*.sql in order to a PGlite database (local dev and tests). */
export async function applyMigrations(db: Exec) {
  await db.exec("create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())");
  const applied = new Set(
    ((await db.query("select name from schema_migrations")).rows as { name: string }[]).map((r) => r.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  // the migrations were rewritten once (scope change): a database made from the old files can't be upgraded
  const unknown = [...applied].filter((name) => !files.includes(name));
  if (unknown.length) {
    throw new Error(
      `This local database was made with old migrations (${unknown.join(", ")}). Delete the .data folder and start again.`,
    );
  }
  for (const file of files) {
    if (applied.has(file)) continue;
    // the migration files are part of the code (never user input); each runs in one transaction
    const migration = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await db.exec("begin");
    await db.exec(migration);
    await db.exec("commit");
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
}
