-- Podcast times: the team sets when pairs can meet (like digital support slots), and people choose
-- one when they sign up for the podcast. A time is full for residents once as many residents as
-- pairs chose it, and the same for students.

create table podcast_times (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  time_date date not null,
  start_time text not null check (start_time ~ '^\d\d:\d\d$'),
  end_time text not null check (end_time ~ '^\d\d:\d\d$'),
  place_he text not null check (char_length(place_he) between 1 and 200),
  place_en text check (char_length(place_en) <= 200),
  pairs int not null check (pairs between 1 and 50),
  -- false: shown to the team only, nobody new can choose it
  open boolean not null default true,
  check (end_time > start_time)
);
create index podcast_times_date_idx on podcast_times (time_date, start_time);

-- the time a person chose (null: "send me a message and we'll arrange it", or signed up before times existed)
alter table podcast_participants add column time_id uuid references podcast_times (id) on delete set null;
create index podcast_participants_time_idx on podcast_participants (time_id);

-- Times with how many residents and students (still taking part) chose each.
create view podcast_time_overview with (security_invoker = true) as
  select t.id, t.created_at, to_char(t.time_date, 'YYYY-MM-DD') as time_date, t.start_time, t.end_time,
         t.place_he, t.place_en, t.pairs, t.open,
         israel_time(t.time_date, t.start_time) as starts_at,
         (select count(*)::int from podcast_participants p where p.time_id = t.id and p.active and p.portal = 'resident') as residents,
         (select count(*)::int from podcast_participants p where p.time_id = t.id and p.active and p.portal = 'student') as students
    from podcast_times t;

-- podcast_people with the chosen time (new column at the end, so the view can be replaced in place)
create or replace view podcast_people with (security_invoker = true) as
  select p.id, p.created_at, p.name, split_part(trim(p.name), ' ', 1) as first_name, p.email, p.phone, p.portal,
         p.topics, p.language, p.availability, p.registered_by, p.active, p.code, p.manage_token_hash, m.pair_id,
         case when m.pair_id is not null then 'paired'
              when exists (select 1 from podcast_pair_requests r where r.status = 'pending' and p.id in (r.from_id, r.to_id))
              then 'requested' else 'looking' end as status,
         p.time_id
    from podcast_participants p left join podcast_pair_members m on m.participant_id = p.id;

-- Sign up for the podcast, optionally at a time. The time's row is locked, so two people choosing
-- the last place at the same moment are counted one after the other. Returns the new id and
-- 'joined', or a reason: 'not_found' | 'closed' | 'full' | 'duplicate' (this email or phone already
-- signed up). p_staff: the team adding someone may use a closed or full time.
create function podcast_join(p jsonb, p_time uuid, p_staff boolean)
returns table (r_id uuid, r_status text)
language plpgsql set search_path = public, pg_temp as $$
declare
  t podcast_times;
  v_taken int;
  v_id uuid;
begin
  if p_time is not null then
    select * into t from podcast_times where id = p_time for update;
    if not found then
      return query select null::uuid, 'not_found'::text; return;
    end if;
    if israel_time(t.time_date, t.start_time) <= now() or (not p_staff and not t.open) then
      return query select null::uuid, 'closed'::text; return;
    end if;
    select count(*) into v_taken from podcast_participants
     where time_id = p_time and active and portal = p ->> 'portal';
    if not p_staff and v_taken >= t.pairs then
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

-- Pairing as before; when both chose the same time, the pair meets then and there.
create or replace function podcast_make_pair(p_a uuid, p_b uuid, p_created_by text) returns uuid
language plpgsql set search_path = public, pg_temp as $$
declare v_pair uuid;
begin
  if p_a is null or p_b is null or p_a = p_b then return null; end if;
  perform 1 from podcast_participants where id in (p_a, p_b) order by id for update;
  if (select count(*) from podcast_participants where id in (p_a, p_b) and active) <> 2 then
    return null;
  end if;
  if exists (select 1 from podcast_pair_members where participant_id in (p_a, p_b)) then
    return null;
  end if;
  insert into podcast_pairs (created_by) values (p_created_by) returning id into v_pair;
  insert into podcast_pair_members (pair_id, participant_id) values (v_pair, p_a), (v_pair, p_b);
  update podcast_pair_requests
     set status = case when (from_id = p_a and to_id = p_b) or (from_id = p_b and to_id = p_a)
                       then 'accepted' else 'cancelled' end
   where status = 'pending' and (from_id in (p_a, p_b) or to_id in (p_a, p_b));
  update podcast_pairs pp
     set meeting_date = t.time_date, meeting_time = t.start_time, meeting_place = t.place_he
    from podcast_times t
   where pp.id = v_pair
     and t.id = (select a.time_id from podcast_participants a where a.id = p_a)
     and t.id = (select b.time_id from podcast_participants b where b.id = p_b);
  return v_pair;
exception when unique_violation then
  return null;
end $$;

-- ---------------------------------------------------------------- lock down (as at the end of 0001)

alter table podcast_times enable row level security;
revoke all on podcast_times, podcast_time_overview, podcast_people from public;
revoke execute on function podcast_join(jsonb, uuid, boolean), podcast_make_pair(uuid, uuid, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on podcast_times, podcast_time_overview, podcast_people from anon, authenticated';
    execute 'revoke execute on function podcast_join(jsonb, uuid, boolean), podcast_make_pair(uuid, uuid, text) from anon, authenticated';
  end if;
end $$;
