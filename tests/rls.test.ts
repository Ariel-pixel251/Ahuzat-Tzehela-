import { beforeAll, describe, expect, test } from "vitest";
import type { Db } from "@/lib/db/types";
import { testDb } from "./helpers/db";

// Supabase's public API runs as "anon" (no sign-in) or "authenticated" (any signed-in user, e.g.
// an admin). The site never uses them: everything goes through the server. These tests prove that
// neither role can read, write or call anything, so the public key can't reach personal data.

let db: Db & { pg: import("@electric-sql/pglite").PGlite };
let tables: string[];
let views: string[];
let functions: string[];

beforeAll(async () => {
  db = await testDb();
  tables = (await db.query<{ t: string }>(`select tablename as t from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations'`)).map((r) => r.t);
  views = (await db.query<{ v: string }>(`select viewname as v from pg_views where schemaname = 'public'`)).map((r) => r.v);
  functions = (
    await db.query<{ f: string }>(
      `select p.oid::regprocedure::text as f from pg_proc p where p.pronamespace = 'public'::regnamespace`,
    )
  ).map((r) => r.f);
});

const SET_ROLE = { anon: "set role anon", authenticated: "set role authenticated" } as const;

async function asRole<T>(role: string, fn: () => Promise<T>) {
  await db.pg.exec(SET_ROLE[role as keyof typeof SET_ROLE]);
  try {
    return await fn();
  } finally {
    await db.pg.exec("reset role");
  }
}

async function denied(role: string, sql: string) {
  return asRole(role, async () => {
    try {
      await db.pg.query(sql);
      return false;
    } catch (err) {
      return /permission denied/i.test(String((err as Error).message));
    }
  });
}

describe("the public API roles can't touch anything", () => {
  test("the schema has the expected tables (and none of the removed features)", () => {
    expect(tables).toEqual(expect.arrayContaining(["digital_slots", "digital_bookings", "digital_volunteers", "event_registrations", "podcast_participants", "audit_log"]));
    for (const gone of ["lesson_topics", "lesson_requests", "courses", "timetable_slots", "announcements", "visit_requests", "lecture_proposals", "digital_requests"]) {
      expect(tables).not.toContain(gone);
    }
  });

  test("row level security is on for every table", async () => {
    const off = await db.query<{ t: string }>(
      `select relname as t from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
          and not relrowsecurity and relname <> 'schema_migrations'`,
    );
    expect(off).toEqual([]);
  });

  for (const role of ["anon", "authenticated"]) {
    test(`${role}: no table or view can be read, written or deleted`, async () => {
      for (const t of [...tables, ...views]) {
        expect(await denied(role, `select * from ${t} limit 1`), `select ${t}`).toBe(true);
        const [priv] = await db.query<{ any: boolean }>(
          `select has_table_privilege($1, $2, 'select, insert, update, delete, truncate, references, trigger') as any`,
          [role, `public.${t}`],
        );
        expect(priv.any, `any privilege on ${t}`).toBe(false);
      }
      for (const t of tables) {
        expect(await denied(role, `delete from ${t}`), `delete ${t}`).toBe(true);
        expect(await denied(role, `insert into ${t} default values`), `insert ${t}`).toBe(true);
      }
    });

    test(`${role}: no function can be called`, async () => {
      expect(functions.length).toBeGreaterThan(10);
      const callable = await asRole(role, async () => {
        const rows = await db.pg.query<{ f: string }>(
          `select p.oid::regprocedure::text as f from pg_proc p
            where p.pronamespace = 'public'::regnamespace and has_function_privilege(p.oid, 'execute')`,
        );
        return rows.rows.map((r) => r.f);
      });
      expect(callable).toEqual([]);
    });
  }

  test("every function has a fixed search_path and none runs with its owner's rights", async () => {
    const loose = await db.query<{ f: string }>(
      `select p.oid::regprocedure::text as f from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and (p.prosecdef or not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))`,
    );
    expect(loose).toEqual([]);
  });

  test("views run with the caller's rights (security_invoker)", async () => {
    const unsafe = await db.query<{ v: string }>(
      `select c.relname as v from pg_class c
        where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
          and not coalesce(c.reloptions @> array['security_invoker=true'], false)`,
    );
    expect(unsafe).toEqual([]);
  });
});
