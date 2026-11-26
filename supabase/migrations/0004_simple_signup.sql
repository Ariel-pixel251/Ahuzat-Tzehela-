-- Simple sign-up (owner's request, 2026-11): students sign up for slots and podcast times straight
-- from a card (no account), and everyone picks one of the times the team created.
--
-- 1. Student volunteers get a cancel link (only the hash of its token is stored).
-- 2. Podcast times work like digital support slots: places for residents and places for students
--    (instead of one "pairs" number), and a time can be cancelled.
-- 3. A person can sign up for the podcast again after leaving or after their time was cancelled:
--    one email / phone counts once only among the people still taking part.
-- Nothing is deleted. Safe to run once on a database made from 0001–0003.

-- ---------------------------------------------------------------- 1. volunteers' cancel links

alter table digital_volunteers add column manage_token_hash text unique;

-- ---------------------------------------------------------------- 2. podcast times like slots

alter table podcast_times add column resident_places int check (resident_places between 1 and 50);
alter table podcast_times add column student_places int check (student_places between 1 and 50);
update podcast_times set resident_places = pairs, student_places = pairs;
alter table podcast_times alter column resident_places set not null;
alter table podcast_times alter column student_places set not null;
alter table podcast_times add column status text not null default 'scheduled' check (status in ('scheduled', 'cancelled'));
alter table podcast_times add column cancelled_at timestamptz;

-- the view gets the new columns at the end, so it can be replaced in place
create or replace view podcast_time_overview with (security_invoker = true) as
  select t.id, t.created_at, to_char(t.time_date, 'YYYY-MM-DD') as time_date, t.start_time, t.end_time,
         t.place_he, t.place_en, t.pairs, t.open,
         israel_time(t.time_date, t.start_time) as starts_at,
         (select count(*)::int from podcast_participants p where p.time_id = t.id and p.active and p.portal = 'resident') as residents,
         (select count(*)::int from podcast_participants p where p.time_id = t.id and p.active and p.portal = 'student') as students,
         t.resident_places, t.student_places, t.status
    from podcast_times t;

-- Sign up for a podcast time. The time's row is locked, so two people choosing the last place at
-- the same moment are counted one after the other. Returns the new id and 'joined', or a reason:
-- 'not_found' | 'closed' | 'full' | 'duplicate' (this email or phone is already taking part).
-- p_staff: the team adding someone may use a closed or full time (not a cancelled or past one).
create or replace function podcast_join(p jsonb, p_time uuid, p_staff boolean)
returns table (r_id uuid, r_status text)
language plpgsql set search_path = public, pg_temp as $$
declare
  t podcast_times;
  v_taken int;
  v_places int;
  v_id uuid;
begin
  if p_time is not null then
    select * into t from podcast_times where id = p_time for update;
    if not found or t.status <> 'scheduled' then
      return query select null::uuid, 'not_found'::text; return;
    end if;
    if israel_time(t.time_date, t.start_time) <= now() or (not p_staff and not t.open) then
      return query select null::uuid, 'closed'::text; return;
    end if;
    select count(*) into v_taken from podcast_participants
     where time_id = p_time and active and portal = p ->> 'portal';
    v_places := case when p ->> 'portal' = 'resident' then t.resident_places else t.student_places end;
    if not p_staff and v_taken >= v_places then
      return query select null::uuid, 'full'::text; return;
    end if;
  end if;
  insert into podcast_participants
    (name, email, phone, portal, topics, language, availability, registered_by, code, manage_token_hash, time_id)
  values (p ->> 'name', p ->> 'email', p ->> 'phone', p ->> 'portal', text_array(p -> 'topics'), p ->> 'language',
          p ->> 'availability', p ->> 'registered_by', p ->> 'code', p ->> 'manage_token_hash', p_time)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return query select null::uuid, 'duplicate'::text; return;
  end if;
  return query select v_id, 'joined'::text;
end $$;

-- ---------------------------------------------------------------- 3. sign up again after leaving

drop index podcast_participants_email_key;
drop index podcast_participants_phone_key;
create unique index podcast_participants_email_key on podcast_participants (lower(email)) where email is not null and active;
create unique index podcast_participants_phone_key on podcast_participants (phone) where phone is not null and active;

-- ---------------------------------------------------------------- lock down (as at the end of 0001)

revoke all on podcast_time_overview from public;
revoke execute on function podcast_join(jsonb, uuid, boolean) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on podcast_time_overview from anon, authenticated';
    execute 'revoke execute on function podcast_join(jsonb, uuid, boolean) from anon, authenticated';
  end if;
end $$;
