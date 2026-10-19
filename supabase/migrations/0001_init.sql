-- Ahuzat Tzahala: initial schema.
--
-- Access model
-- * The website reads and writes only from the server, through DATABASE_URL (the privileged
--   `postgres` role, which owns these tables and bypasses RLS, like the service role).
-- * Row Level Security is enabled on every table with NO policies for the public API roles,
--   and their privileges are revoked. Nobody can read (or write) anything, contact details
--   included, through Supabase's public REST API with the anon key. Public sign-ups go through
--   the site's server code, which validates input, checks the honeypot and rate-limits.
-- * Admins are checked by the server (Supabase Auth + ADMIN_EMAILS) before any admin query.

create function text_array(p jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) as x
$$;

-- ---------------------------------------------------------------- settings, rate limits, outbound messages

create table settings (
  key text primary key,
  value jsonb not null
);
insert into settings (key, value) values ('require_match_approval', 'false');

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);

-- Returns true while the caller is under p_max hits in the current window.
create function hit_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into rate_limits (key, window_start) values (p_key, v_window)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end $$;

-- Messages for people without email (SMS/WhatsApp), sent by hand from the admin area
-- until an SMS provider is connected.
create table outbound_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  channel text not null check (channel in ('sms', 'whatsapp')),
  to_phone text not null,
  to_name text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent')),
  sent_at timestamptz
);

-- ---------------------------------------------------------------- event registrations

-- One table for every calendar-event form (generic, language night, game night, memorial).
-- event_key is the iCal UID, or UID + "::" + occurrence date for recurring events.
-- Title/date/time are a snapshot taken at registration, so history survives calendar edits.
create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_key text not null,
  event_title_en text not null,
  event_title_he text not null,
  event_date date not null,
  event_time text check (event_time ~ '^\d\d:\d\d$'),
  kind text not null default 'general' check (kind in ('general', 'language-night', 'game-night', 'memorial')),
  portal text not null check (portal in ('student', 'resident')),
  name text not null check (char_length(name) between 1 and 100),
  phone text check (char_length(phone) <= 20),
  email text check (char_length(email) <= 200),
  attendees int not null default 1 check (attendees between 1 and 10),
  notes text check (char_length(notes) <= 500),
  languages text[] not null default '{}',
  other_language text check (char_length(other_language) <= 60),
  preferred_language text,
  role text check (char_length(role) <= 40),
  status text not null default 'confirmed' check (status in ('confirmed', 'waitlist', 'cancelled')),
  code text not null check (code ~ '^\d{4}$'),
  manage_token_hash text unique,
  registered_by text,
  reminder_sent_for text,
  cancel_notice_sent_at timestamptz,
  constraint event_contact_required check (phone is not null or email is not null)
);
create index event_registrations_event_idx on event_registrations (event_key, status, created_at);
create unique index event_registrations_once_by_email
  on event_registrations (event_key, lower(email)) where email is not null and status <> 'cancelled';
create unique index event_registrations_once_by_phone
  on event_registrations (event_key, phone) where phone is not null and status <> 'cancelled';

-- Register with an optional capacity (in attendees). A per-event advisory lock serialises
-- concurrent sign-ups, so the capacity can't be overshot. Returns the new row's id and
-- status ('confirmed' or 'waitlist'), or status 'duplicate' if already registered.
create function register_for_event(p jsonb, p_capacity int)
returns table (r_id uuid, r_status text)
language plpgsql as $$
declare
  v_taken int;
  v_status text := 'confirmed';
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('event:' || (p ->> 'event_key')));
  if p_capacity is not null then
    select coalesce(sum(attendees), 0) into v_taken
      from event_registrations where event_key = p ->> 'event_key' and status = 'confirmed';
    if v_taken + coalesce((p ->> 'attendees')::int, 1) > p_capacity then
      v_status := 'waitlist';
    end if;
  end if;
  begin
    insert into event_registrations (
      event_key, event_title_en, event_title_he, event_date, event_time, kind, portal, name, phone, email,
      attendees, notes, languages, other_language, preferred_language, role, status, code,
      manage_token_hash, registered_by)
    values (
      p ->> 'event_key', p ->> 'event_title_en', p ->> 'event_title_he', (p ->> 'event_date')::date,
      p ->> 'event_time', coalesce(p ->> 'kind', 'general'), p ->> 'portal', p ->> 'name', p ->> 'phone',
      p ->> 'email', coalesce((p ->> 'attendees')::int, 1), p ->> 'notes', text_array(p -> 'languages'),
      p ->> 'other_language', p ->> 'preferred_language', p ->> 'role', v_status, p ->> 'code',
      p ->> 'manage_token_hash', p ->> 'registered_by')
    returning id into v_id;
  exception when unique_violation then
    return query select null::uuid, 'duplicate'::text;
    return;
  end;
  return query select v_id, v_status;
end $$;

-- Cancel a registration and move people up from the waiting list while they fit.
-- Returns the ids that were promoted to 'confirmed'.
create function cancel_event_registration(p_id uuid, p_capacity int) returns setof uuid
language plpgsql as $$
declare
  v_key text;
  v_taken int;
  w record;
begin
  select event_key into v_key from event_registrations where id = p_id;
  if v_key is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('event:' || v_key));
  update event_registrations set status = 'cancelled' where id = p_id and status <> 'cancelled';
  if not found or p_capacity is null then return; end if;
  select coalesce(sum(attendees), 0) into v_taken
    from event_registrations where event_key = v_key and status = 'confirmed';
  for w in select id, attendees from event_registrations
            where event_key = v_key and status = 'waitlist' order by created_at loop
    if v_taken + w.attendees <= p_capacity then
      update event_registrations set status = 'confirmed' where id = w.id;
      v_taken := v_taken + w.attendees;
      return next w.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- students (for digital support)

create table students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (char_length(phone) <= 20),
  conduct_accepted_at timestamptz
);
create unique index students_email_key on students (lower(email));

-- Magic-link login tokens (single use) and session tokens. Only SHA-256 hashes are stored.
create table student_tokens (
  token_hash text primary key,
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('login', 'session')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index student_tokens_student_idx on student_tokens (student_id, kind, created_at);

-- ---------------------------------------------------------------- digital support

create table digital_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resident_name text not null check (char_length(resident_name) between 1 and 100),
  resident_phone text not null check (char_length(resident_phone) <= 20),
  resident_email text check (char_length(resident_email) <= 200),
  needs text[] not null default '{}',
  needs_other text check (char_length(needs_other) <= 300),
  preferred_days text[] not null default '{}',
  preferred_parts text[] not null default '{}',
  language text not null default 'he',
  status text not null default 'open' check (status in ('open', 'assigned', 'done', 'cancelled')),
  student_id uuid references students (id),
  assigned_at timestamptz,
  approved_at timestamptz,
  code text not null check (code ~ '^\d{4}$'),
  manage_token_hash text unique,
  registered_by text,
  constraint digital_assigned_has_student check (status <> 'assigned' or student_id is not null),
  constraint digital_open_has_no_student check (status <> 'open' or student_id is null)
);
create index digital_requests_status_idx on digital_requests (status, created_at);
create index digital_requests_student_idx on digital_requests (student_id);
create index digital_requests_phone_idx on digital_requests (resident_phone);

-- Take an open request. The conditional UPDATE is atomic: if two students click at the same
-- time, the second waits for the first, re-checks status = 'open' and matches nothing.
-- p_auto_approve = false leaves the match waiting for a leader's approval.
create function claim_digital_request(p_request_id uuid, p_student_id uuid, p_auto_approve boolean)
returns boolean
language plpgsql as $$
declare n int;
begin
  update digital_requests
     set status = 'assigned', student_id = p_student_id, assigned_at = now(),
         approved_at = case when p_auto_approve then now() end, updated_at = now()
   where id = p_request_id and status = 'open';
  get diagnostics n = row_count;
  return n = 1;
end $$;

create function release_digital_request(p_request_id uuid, p_student_id uuid) returns boolean
language plpgsql as $$
declare n int;
begin
  update digital_requests
     set status = 'open', student_id = null, assigned_at = null, approved_at = null, updated_at = now()
   where id = p_request_id and student_id = p_student_id and status = 'assigned';
  get diagnostics n = row_count;
  return n = 1;
end $$;

create function complete_digital_request(p_request_id uuid, p_student_id uuid) returns boolean
language plpgsql as $$
declare n int;
begin
  update digital_requests set status = 'done', updated_at = now()
   where id = p_request_id and student_id = p_student_id and status = 'assigned' and approved_at is not null;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Admin: assign to a student (approved at once), or back to open with null.
create function admin_assign_digital_request(p_request_id uuid, p_student_id uuid) returns boolean
language plpgsql as $$
declare n int;
begin
  update digital_requests
     set status = case when p_student_id is null then 'open' else 'assigned' end,
         student_id = p_student_id,
         assigned_at = case when p_student_id is null then null else now() end,
         approved_at = case when p_student_id is null then null else now() end,
         updated_at = now()
   where id = p_request_id and status in ('open', 'assigned');
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ---------------------------------------------------------------- podcast pairs

create table podcast_participants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 20),
  portal text not null check (portal in ('student', 'resident')),
  topics text[] not null default '{}',
  language text not null,
  availability text check (char_length(availability) <= 300),
  active boolean not null default true,
  code text not null check (code ~ '^\d{4}$'),
  manage_token_hash text unique,
  registered_by text,
  constraint podcast_contact_required check (email is not null or phone is not null)
);
create unique index podcast_participants_email_key on podcast_participants (lower(email)) where email is not null;
create unique index podcast_participants_phone_key on podcast_participants (phone) where phone is not null;

create table podcast_pairs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text not null check (created_by in ('participants', 'admin'))
);

-- UNIQUE (participant_id): one person belongs to at most one pair.
create table podcast_pair_members (
  pair_id uuid not null references podcast_pairs (id) on delete cascade,
  participant_id uuid not null references podcast_participants (id) on delete cascade,
  primary key (pair_id, participant_id),
  constraint podcast_one_pair_per_person unique (participant_id)
);

create table podcast_pair_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  from_id uuid not null references podcast_participants (id) on delete cascade,
  to_id uuid not null references podcast_participants (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  check (from_id <> to_id)
);
create unique index podcast_pending_request_key on podcast_pair_requests (from_id, to_id) where status = 'pending';

-- Pair two active, unpaired people. Returns the pair id, or null if either is inactive or
-- already paired. Rows are locked in id order so concurrent calls serialise; the unique
-- constraint above is the final guard.
create function podcast_make_pair(p_a uuid, p_b uuid, p_created_by text) returns uuid
language plpgsql as $$
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
  return v_pair;
exception when unique_violation then
  return null;
end $$;

-- Ask someone to be your partner; if they already asked you, you are paired at once.
-- Returns 'paired' | 'requested' | 'already_requested' | 'unavailable'.
create function podcast_request_pair(p_from uuid, p_to uuid) returns text
language plpgsql as $$
begin
  if p_from = p_to
     or (select count(*) from podcast_participants where id in (p_from, p_to) and active) <> 2
     or exists (select 1 from podcast_pair_members where participant_id in (p_from, p_to)) then
    return 'unavailable';
  end if;
  if exists (select 1 from podcast_pair_requests
              where from_id = p_to and to_id = p_from and status = 'pending') then
    if podcast_make_pair(p_from, p_to, 'participants') is null then return 'unavailable'; end if;
    return 'paired';
  end if;
  insert into podcast_pair_requests (from_id, to_id) values (p_from, p_to) on conflict do nothing;
  if not found then return 'already_requested'; end if;
  return 'requested';
end $$;

-- Returns 'paired' | 'declined' | 'unavailable'.
create function podcast_respond_request(p_request_id uuid, p_to uuid, p_accept boolean) returns text
language plpgsql as $$
declare r podcast_pair_requests;
begin
  select * into r from podcast_pair_requests
   where id = p_request_id and to_id = p_to and status = 'pending' for update;
  if not found then return 'unavailable'; end if;
  if not p_accept then
    update podcast_pair_requests set status = 'declined' where id = r.id;
    return 'declined';
  end if;
  if podcast_make_pair(r.from_id, r.to_id, 'participants') is null then return 'unavailable'; end if;
  return 'paired';
end $$;

-- ---------------------------------------------------------------- private lessons

create table lesson_topics (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_he text not null,
  active boolean not null default true,
  sort int not null default 0
);

create table lesson_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null check (role in ('learn', 'teach')),
  portal text not null check (portal in ('student', 'resident')),
  name text not null check (char_length(name) between 1 and 100),
  phone text check (char_length(phone) <= 20),
  email text check (char_length(email) <= 200),
  topics text[] not null default '{}',
  other_topic text check (char_length(other_topic) <= 200),
  notes text check (char_length(notes) <= 500),
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  code text not null check (code ~ '^\d{4}$'),
  registered_by text,
  constraint lesson_contact_required check (phone is not null or email is not null)
);

-- A learner has at most one match; a teacher may teach several learners.
create table lesson_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  learner_id uuid not null unique references lesson_requests (id) on delete cascade,
  teacher_id uuid not null references lesson_requests (id) on delete cascade,
  topic text
);

-- ---------------------------------------------------------------- lecture proposals, visits, callbacks

create table lecture_proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) <= 20),
  email text check (char_length(email) <= 200),
  topic text not null check (char_length(topic) between 1 and 200),
  language text not null default 'he',
  preferred_date text check (char_length(preferred_date) <= 100),
  description text check (char_length(description) <= 1000),
  status text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  code text not null check (code ~ '^\d{4}$'),
  registered_by text
);

create table visit_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  organization text check (char_length(organization) <= 200),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 20),
  preferred_dates text check (char_length(preferred_dates) <= 200),
  group_size int check (group_size between 1 and 200),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'new' check (status in ('new', 'scheduled', 'declined'))
);

create table callback_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) <= 20),
  handled boolean not null default false,
  handled_at timestamptz,
  registered_by text
);

-- ---------------------------------------------------------------- courses, timetable, announcements

create table courses (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_he text not null,
  description_en text,
  description_he text,
  active boolean not null default true,
  sort int not null default 0
);

create table timetable_slots (
  id uuid primary key default gen_random_uuid(),
  day smallint not null check (day between 0 and 6), -- 0 = Sunday
  start_time text not null check (start_time ~ '^\d\d:\d\d$'),
  end_time text check (end_time ~ '^\d\d:\d\d$'),
  title_en text not null,
  title_he text not null,
  location_en text,
  location_he text
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  text_en text not null check (char_length(text_en) <= 500),
  text_he text not null check (char_length(text_he) <= 500),
  active boolean not null default true,
  expires_on date
);

-- ---------------------------------------------------------------- leaders and tasks

create table leaders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  phone text check (char_length(phone) <= 20),
  email text check (char_length(email) <= 200),
  project text not null check (project in ('podcast', 'game-night', 'digital-support', 'language-night', 'other'))
);

create table leader_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  leader_id uuid references leaders (id) on delete set null,
  project text not null check (project in ('podcast', 'game-night', 'digital-support', 'language-night', 'other')),
  title text not null check (char_length(title) between 1 and 300),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due_on date
);

-- ---------------------------------------------------------------- retention

-- Registrations are deleted 90 days after their event; cancelled requests are deleted
-- (run daily by the cron route).
create function purge_old_data() returns void
language plpgsql as $$
begin
  delete from event_registrations where event_date < current_date - 90;
  delete from digital_requests where status = 'cancelled';
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from student_tokens where expires_at < now();
end $$;

-- ---------------------------------------------------------------- lock down the public API

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from public;
revoke execute on all functions in schema public from public;

do $$
begin
  -- Supabase's API roles (absent in plain Postgres and local PGlite).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke execute on all functions in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke execute on functions from anon, authenticated';
  end if;
end $$;
