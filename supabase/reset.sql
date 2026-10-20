-- ONE-TIME RESET before running the rewritten 0001_init.sql on a database that already has the
-- old schema (lessons, courses, visits, the open digital-support requests, ...).
--
-- WARNING: this deletes ALL the site's tables and their data. There is no real data yet, so this
-- is the planned way to move to the new schema. Download any CSV you want to keep first.
--
-- Supabase → SQL Editor → New query → paste this file → Run. Then paste and run
-- supabase/migrations/0001_init.sql.
--
-- Only the site's own tables, views and functions in the "public" schema are removed; Supabase's
-- own schemas (auth, storage, ...) and functions that belong to extensions are left alone.

do $$
declare r record;
begin
  for r in select viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.fn);
  end loop;
end $$;
