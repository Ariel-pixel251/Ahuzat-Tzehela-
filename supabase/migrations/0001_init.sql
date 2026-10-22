-- EMIS × Ahuzat Tzahala: the whole schema (events, podcast pairs, digital support slots).
--
-- Access model
-- * The website reads and writes only from the server, through DATABASE_URL (the privileged
--   `postgres` role, which owns these tables and bypasses RLS, like the service role).
-- * Row Level Security is enabled on every table with NO policies, and the public API roles
--   (anon, authenticated) have no privileges at all: nothing, contact details included, can be
--   read or written through Supabase's public REST API. Sign-ups go through the site's server
--   code, which validates input, checks the honeypot and rate-limits.
-- * Admins are checked by the server (Supabase Auth + ADMIN_EMAILS) before any admin query.
-- * Every function has a fixed search_path and uses only bind parameters (no dynamic SQL).

create function text_array(p jsonb) returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) as x
$$;

-- Israel time of a date + "HH:MM" as a timestamp.
create function israel_time(p_date date, p_time text) returns timestamptz
language sql stable set search_path = public, pg_temp as $$
  select (p_date + p_time::time) at time zone 'Asia/Jerusalem'
$$;

-- ---------------------------------------------------------------- settings, rate limits, messages, audit

create table settings (
  key text primary key,
  value jsonb not null
);
insert into settings (key, value) values
  ('require_helper_approval', 'false'),
  ('student_cancel_cutoff_hours', '24');

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);

-- Returns true while the caller is under p_max hits in the current window.
create function hit_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql set search_path = public, pg_temp as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into rate_limits (key, window_start) values (p_key, v_window)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end $$;

-- 4-digit request codes: after 5 wrong codes for a phone number, lookups for it are locked.
create table code_lockouts (
  phone text primary key check (char_length(phone) <= 20),
  failures int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Counts a code attempt for a phone number BEFORE the lookup, in one atomic step, so many requests
-- at the same moment can't get past the limit. Returns false when the phone is locked (more than
-- p_max attempts without a right code); the lock lasts p_lock_hours. A right code clears the count.
create function code_attempt(p_phone text, p_max int, p_lock_hours int) returns boolean
language plpgsql set search_path = public, pg_temp as $$
declare r code_lockouts;
begin
  insert into code_lockouts (phone, failures) values (p_phone, 1)
  on conflict (phone) do update set
    failures = case when code_lockouts.locked_until < now() then 1 else code_lockouts.failures + 1 end,
    locked_until = case when code_lockouts.locked_until < now() then null else code_lockouts.locked_until end,
    updated_at = now()
  returning * into r;
  if r.locked_until is not null then return false; end if;
  if r.failures > p_max then
    update code_lockouts set locked_until = now() + make_interval(hours => p_lock_hours) where phone = p_phone;
    return false;
  end if;
  return true;
end $$;

-- Messages for people without email (SMS/WhatsApp), sent by hand from the admin area
-- until an SMS provider is connected.
create table outbound_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  channel text not null check (channel in ('sms', 'whatsapp')),
  to_phone text not null check (char_length(to_phone) <= 20),
  to_name text check (char_length(to_name) <= 100),
  body text not null check (char_length(body) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'sent')),
  sent_at timestamptz
);

-- Who viewed, exported or changed what in the admin area. Never holds phone numbers or emails.
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null check (char_length(actor) <= 200),
  action text not null check (char_length(action) <= 100),
  target text check (char_length(target) <= 200),
  details jsonb
);
create index audit_log_at_idx on audit_log (at desc);

-- "Report a problem" from either portal; only admins see these.
create table problem_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  portal text not null check (portal in ('student', 'resident')),
  name text check (char_length(name) <= 100),
  contact text check (char_length(contact) <= 200),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'handled')),
  handled_at timestamptz
);

-- People an admin blocked (by phone or email): they can't sign up or volunteer.
create table blocked_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('phone', 'email')),
  value text not null check (char_length(value) between 3 and 200),
  reason text check (char_length(reason) <= 300),
  blocked_by text not null,
  unique (kind, value)
);

-- ---------------------------------------------------------------- event registrations

-- One table for every calendar-event form (general, language night, game night).
-- event_key is the iCal UID, or UID + "::" + occurrence date for recurring events.
-- Title/date/time are a snapshot taken at registration, so history survives calendar edits.
create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_key text not null check (char_length(event_key) <= 600),
  event_title_en text not null check (char_length(event_title_en) <= 300),
  event_title_he text not null check (char_length(event_title_he) <= 300),
  event_date date not null,
  event_time text check (event_time ~ '^\d\d:\d\d$'),
  kind text not null default 'general' check (kind in ('general', 'language-night', 'game-night')),
  portal text not null check (portal in ('student', 'resident')),
  name text not null check (char_length(name) between 1 and 100),
  phone text check (char_length(phone) <= 20),
  email text check (char_length(email) <= 200),
  attendees int not null default 1 check (attendees between 1 and 10),
  notes text check (char_length(notes) <= 500),
  languages text[] not null default '{}',
  other_language text check (char_length(other_language) <= 60),
  preferred_language text check (char_length(preferred_language) <= 10),
  status text not null default 'confirmed' check (status in ('confirmed', 'waitlist', 'cancelled')),
  cancelled_at timestamptz,
  code text not null check (code ~ '^\d{4}$'),
  manage_token_hash text unique,
  registered_by text check (char_length(registered_by) <= 200),
  reminder_sent_for text,
  cancel_notice_sent_at timestamptz,
  constraint event_contact_required check (phone is not null or email is not null)
);
create index event_registrations_event_idx on event_registrations (event_key, status, created_at);
create index event_registrations_phone_idx on event_registrations (phone);
create unique index event_registrations_once_by_email
  on event_registrations (event_key, lower(email)) where email is not null and status <> 'cancelled';
create unique index event_registrations_once_by_phone
  on event_registrations (event_key, phone) where phone is not null and status <> 'cancelled';

-- Registrations as the site reads them (date as 'YYYY-MM-DD' text).
create view event_registration_list with (security_invoker = true) as
  select id, created_at, event_key, event_title_en, event_title_he, to_char(event_date, 'YYYY-MM-DD') as event_date,
         event_time, kind, portal, name, phone, email, attendees, notes, languages, other_language, preferred_language,
         registered_by, status, code, manage_token_hash, reminder_sent_for, cancel_notice_sent_at
    from event_registrations;

-- Register with an optional capacity (in attendees). A per-event advisory lock serialises
-- concurrent sign-ups, so the capacity can't be overshot. Returns the new row's id and
-- status ('confirmed' or 'waitlist'), or status 'duplicate' if already registered.
create function register_for_event(p jsonb, p_capacity int)
returns table (r_id uuid, r_status text)
language plpgsql set search_path = public, pg_temp as $$
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
      attendees, notes, languages, other_language, preferred_language, status, code,
      manage_token_hash, registered_by)
    values (
      p ->> 'event_key', p ->> 'event_title_en', p ->> 'event_title_he', (p ->> 'event_date')::date,
      p ->> 'event_time', coalesce(p ->> 'kind', 'general'), p ->> 'portal', p ->> 'name', p ->> 'phone',
      p ->> 'email', coalesce((p ->> 'attendees')::int, 1), p ->> 'notes', text_array(p -> 'languages'),
      p ->> 'other_language', p ->> 'preferred_language', v_status, p ->> 'code',
      p ->> 'manage_token_hash', p ->> 'registered_by')
    returning id into v_id;
  exception when unique_violation then
    return query select null::uuid, 'duplicate'::text;
    return;
  end;
  return query select v_id, v_status;
end $$;

-- Move people up from the waiting list while they fit the event's capacity.
-- Returns the ids that were promoted to 'confirmed'.
create function promote_waitlist(p_key text, p_capacity int) returns setof uuid
language plpgsql set search_path = public, pg_temp as $$
declare
  v_taken int;
  w record;
begin
  if p_capacity is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('event:' || p_key));
  select coalesce(sum(attendees), 0) into v_taken
    from event_registrations where event_key = p_key and status = 'confirmed';
  for w in select id, attendees from event_registrations
            where event_key = p_key and status = 'waitlist' order by created_at loop
    if v_taken + w.attendees <= p_capacity then
      update event_registrations set status = 'confirmed' where id = w.id;
      v_taken := v_taken + w.attendees;
      return next w.id;
    end if;
  end loop;
end $$;

-- Cancel a registration and move people up from the waiting list while they fit.
-- Returns the ids that were promoted to 'confirmed'.
create function cancel_event_registration(p_id uuid, p_capacity int) returns setof uuid
language plpgsql set search_path = public, pg_temp as $$
declare v_key text;
begin
  select event_key into v_key from event_registrations where id = p_id;
  if v_key is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('event:' || v_key));
  update event_registrations set status = 'cancelled', cancelled_at = now() where id = p_id and status <> 'cancelled';
  if not found or p_capacity is null then return; end if;
  return query select promote_waitlist(v_key, p_capacity);
end $$;

-- ---------------------------------------------------------------- students (digital support volunteers)

create table students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  -- students sign in with their email; an admin can also add a student without one
  email text check (char_length(email) between 3 and 200),
  phone text check (char_length(phone) <= 20),
  added_by text check (char_length(added_by) <= 200),
  -- set the first time the student opens a sign-in link (proves they own the email)
  verified_at timestamptz,
  age_group text check (age_group in ('under-18', '18-plus')),
  guardian_name text check (char_length(guardian_name) <= 100),
  guardian_phone text check (char_length(guardian_phone) <= 20),
  guardian_confirmed_at timestamptz,
  conduct_accepted_at timestamptz,
  constraint students_minor_has_guardian check (
    age_group is distinct from 'under-18'
    or (guardian_name is not null and guardian_phone is not null and guardian_confirmed_at is not null))
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

-- ---------------------------------------------------------------- digital support: admin-set time slots

-- A weekly pattern ("every Tuesday 16:00-17:30 until ..."). Its occurrences are rows in
-- digital_slots, each editable or cancellable on its own.
create table digital_slot_series (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_date date not null,
  until_date date not null,
  start_time text not null check (start_time ~ '^\d\d:\d\d$'),
  end_time text not null check (end_time ~ '^\d\d:\d\d$'),
  created_by text not null,
  check (until_date >= first_date and until_date <= first_date + 400),
  check (end_time > start_time)
);

-- Dates with no digital support at all (holidays). Occurrences on them are not created.
create table digital_blocked_dates (
  day date primary key,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);

create table digital_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  series_id uuid references digital_slot_series (id) on delete set null,
  slot_date date not null,
  start_time text not null check (start_time ~ '^\d\d:\d\d$'),
  end_time text not null check (end_time ~ '^\d\d:\d\d$'),
  place_he text not null check (char_length(place_he) between 1 and 200),
  place_en text check (char_length(place_en) <= 200),
  resident_places int not null check (resident_places between 1 and 50),
  helpers_needed int not null check (helpers_needed between 0 and 20),
  note_en text check (char_length(note_en) <= 500),
  note_he text check (char_length(note_he) <= 500),
  booking_open boolean not null default true,
  -- booking closes this many hours before the start (null: until it starts)
  closes_hours_before int check (closes_hours_before between 0 and 336),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancelled_at timestamptz,
  check (end_time > start_time)
);
create index digital_slots_date_idx on digital_slots (slot_date, start_time);
create unique index digital_slots_series_once on digital_slots (series_id, slot_date) where series_id is not null;

create table digital_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slot_id uuid not null references digital_slots (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) <= 20),
  email text check (char_length(email) <= 200),
  needs text[] not null default '{}',
  needs_other text check (char_length(needs_other) <= 300),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancelled_at timestamptz,
  code text not null check (code ~ '^\d{4}$'),
  manage_token_hash text unique,
  registered_by text check (char_length(registered_by) <= 200),
  reminder_sent_at timestamptz,
  notice_sent_at timestamptz
);
-- one booking per phone number per slot
create unique index digital_bookings_once on digital_bookings (slot_id, phone) where status = 'confirmed';
create index digital_bookings_phone_idx on digital_bookings (phone);

create table digital_volunteers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slot_id uuid not null references digital_slots (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  approved_at timestamptz,
  cancelled_at timestamptz,
  reminder_sent_at timestamptz
);
create unique index digital_volunteers_once on digital_volunteers (slot_id, student_id) where status <> 'cancelled';

-- Slots with their start/closing time and how many places are taken.
create view digital_slot_overview with (security_invoker = true) as
  select s.id, s.series_id, to_char(s.slot_date, 'YYYY-MM-DD') as slot_date, s.start_time, s.end_time,
         s.place_he, s.place_en, s.resident_places, s.helpers_needed, s.note_en, s.note_he, s.booking_open,
         s.closes_hours_before, s.status, s.updated_at,
         israel_time(s.slot_date, s.start_time) as starts_at,
         israel_time(s.slot_date, s.end_time) as ends_at,
         israel_time(s.slot_date, s.start_time) - make_interval(hours => coalesce(s.closes_hours_before, 0)) as closes_at,
         (select count(*)::int from digital_bookings b where b.slot_id = s.id and b.status = 'confirmed') as booked,
         (select count(*)::int from digital_volunteers v where v.slot_id = s.id and v.status <> 'cancelled') as helpers
    from digital_slots s;

-- Book a place for a resident. The slot row is locked, so two bookings at the same moment are
-- counted one after the other and the slot can't be overbooked. Returns the booking id and
-- 'booked', or a reason: 'not_found' | 'closed' | 'full' | 'duplicate'.
-- p_staff: staff booking on someone's behalf may ignore the closing time (not "full").
create function book_digital_slot(p_slot uuid, p jsonb, p_staff boolean)
returns table (r_id uuid, r_status text)
language plpgsql set search_path = public, pg_temp as $$
declare
  s digital_slots;
  v_taken int;
  v_id uuid;
begin
  select * into s from digital_slots where id = p_slot for update;
  if not found or s.status <> 'scheduled' then
    return query select null::uuid, 'not_found'::text; return;
  end if;
  if israel_time(s.slot_date, s.start_time) <= now()
     or (not p_staff and (not s.booking_open
         or israel_time(s.slot_date, s.start_time) - make_interval(hours => coalesce(s.closes_hours_before, 0)) <= now())) then
    return query select null::uuid, 'closed'::text; return;
  end if;
  if exists (select 1 from digital_bookings where slot_id = p_slot and phone = p ->> 'phone' and status = 'confirmed') then
    return query select null::uuid, 'duplicate'::text; return;
  end if;
  select count(*) into v_taken from digital_bookings where slot_id = p_slot and status = 'confirmed';
  if v_taken >= s.resident_places then
    return query select null::uuid, 'full'::text; return;
  end if;
  insert into digital_bookings (slot_id, name, phone, email, needs, needs_other, code, manage_token_hash, registered_by)
  values (p_slot, p ->> 'name', p ->> 'phone', p ->> 'email', text_array(p -> 'needs'), p ->> 'needs_other',
          p ->> 'code', p ->> 'manage_token_hash', p ->> 'registered_by')
  returning id into v_id;
  return query select v_id, 'booked'::text;
end $$;

-- Volunteer for a slot (students), with the same row lock against over-filling.
-- Returns 'confirmed' | 'pending' (waiting for a leader) | 'not_found' | 'closed' | 'full' | 'duplicate'.
create function volunteer_for_slot(p_slot uuid, p_student uuid, p_auto_approve boolean, p_staff boolean) returns text
language plpgsql set search_path = public, pg_temp as $$
declare
  s digital_slots;
  v_taken int;
begin
  select * into s from digital_slots where id = p_slot for update;
  if not found or s.status <> 'scheduled' then return 'not_found'; end if;
  if israel_time(s.slot_date, s.start_time) <= now() or (not p_staff and not s.booking_open) then return 'closed'; end if;
  if exists (select 1 from digital_volunteers where slot_id = p_slot and student_id = p_student and status <> 'cancelled') then
    return 'duplicate';
  end if;
  select count(*) into v_taken from digital_volunteers where slot_id = p_slot and status <> 'cancelled';
  if v_taken >= s.helpers_needed then return 'full'; end if;
  insert into digital_volunteers (slot_id, student_id, status, approved_at)
  values (p_slot, p_student,
          case when p_auto_approve or p_staff then 'confirmed' else 'pending' end,
          case when p_auto_approve or p_staff then now() end);
  return case when p_auto_approve or p_staff then 'confirmed' else 'pending' end;
end $$;

-- A student cancels their own place, up to p_cutoff_hours before the start.
create function cancel_volunteer(p_volunteer uuid, p_student uuid, p_cutoff_hours int) returns boolean
language plpgsql set search_path = public, pg_temp as $$
declare n int;
begin
  update digital_volunteers v set status = 'cancelled', cancelled_at = now()
    from digital_slots s
   where v.id = p_volunteer and v.student_id = p_student and v.status <> 'cancelled' and s.id = v.slot_id
     and israel_time(s.slot_date, s.start_time) - make_interval(hours => p_cutoff_hours) > now();
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Admin: move a booking to another slot, if it has room. Both slot rows are locked in a fixed
-- order. Returns 'moved' | 'not_found' | 'full' | 'duplicate'.
create function move_booking(p_booking uuid, p_slot uuid) returns text
language plpgsql set search_path = public, pg_temp as $$
declare
  b digital_bookings;
  s digital_slots;
begin
  select * into b from digital_bookings where id = p_booking and status = 'confirmed';
  if not found then return 'not_found'; end if;
  perform 1 from digital_slots where id in (b.slot_id, p_slot) order by id for update;
  select * into s from digital_slots where id = p_slot and status = 'scheduled';
  if not found or b.slot_id = p_slot then return 'not_found'; end if;
  if exists (select 1 from digital_bookings where slot_id = p_slot and phone = b.phone and status = 'confirmed') then
    return 'duplicate';
  end if;
  if (select count(*) from digital_bookings where slot_id = p_slot and status = 'confirmed') >= s.resident_places then
    return 'full';
  end if;
  update digital_bookings set slot_id = p_slot, reminder_sent_at = null where id = p_booking;
  return 'moved';
end $$;

create function move_volunteer(p_volunteer uuid, p_slot uuid) returns text
language plpgsql set search_path = public, pg_temp as $$
declare
  v digital_volunteers;
  s digital_slots;
begin
  select * into v from digital_volunteers where id = p_volunteer and status <> 'cancelled';
  if not found then return 'not_found'; end if;
  perform 1 from digital_slots where id in (v.slot_id, p_slot) order by id for update;
  select * into s from digital_slots where id = p_slot and status = 'scheduled';
  if not found or v.slot_id = p_slot then return 'not_found'; end if;
  if exists (select 1 from digital_volunteers where slot_id = p_slot and student_id = v.student_id and status <> 'cancelled') then
    return 'duplicate';
  end if;
  if (select count(*) from digital_volunteers where slot_id = p_slot and status <> 'cancelled') >= s.helpers_needed then
    return 'full';
  end if;
  update digital_volunteers set slot_id = p_slot, reminder_sent_at = null where id = p_volunteer;
  return 'moved';
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
  language text not null check (char_length(language) <= 10),
  availability text check (char_length(availability) <= 300),
  active boolean not null default true,
  withdrawn_at timestamptz,
  code text not null check (code ~ '^\d{4}$'),
  manage_token_hash text unique,
  registered_by text check (char_length(registered_by) <= 200),
  -- people who sign up themselves give an email or phone; staff may add someone without one
  constraint podcast_contact_required check (email is not null or phone is not null or registered_by is not null)
);
create unique index podcast_participants_email_key on podcast_participants (lower(email)) where email is not null;
create unique index podcast_participants_phone_key on podcast_participants (phone) where phone is not null;

create table podcast_pairs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text not null check (created_by in ('participants', 'admin')),
  -- when and where the pair first meets (set by an admin, optional)
  meeting_date date,
  meeting_time text check (meeting_time ~ '^\d\d:\d\d$'),
  meeting_place text check (char_length(meeting_place) <= 200)
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

-- Participants with their pair and status ('paired' | 'requested' | 'looking').
create view podcast_people with (security_invoker = true) as
  select p.id, p.created_at, p.name, split_part(trim(p.name), ' ', 1) as first_name, p.email, p.phone, p.portal,
         p.topics, p.language, p.availability, p.registered_by, p.active, p.code, p.manage_token_hash, m.pair_id,
         case when m.pair_id is not null then 'paired'
              when exists (select 1 from podcast_pair_requests r where r.status = 'pending' and p.id in (r.from_id, r.to_id))
              then 'requested' else 'looking' end as status
    from podcast_participants p left join podcast_pair_members m on m.participant_id = p.id;

-- Pair two active, unpaired people. Returns the pair id, or null if either is inactive or
-- already paired. Rows are locked in id order so concurrent calls serialise; the unique
-- constraint above is the final guard.
create function podcast_make_pair(p_a uuid, p_b uuid, p_created_by text) returns uuid
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
  return v_pair;
exception when unique_violation then
  return null;
end $$;

-- Ask someone to be your partner; if they already asked you, you are paired at once.
-- Returns 'paired' | 'requested' | 'already_requested' | 'unavailable'.
create function podcast_request_pair(p_from uuid, p_to uuid) returns text
language plpgsql set search_path = public, pg_temp as $$
begin
  -- lock both people (in id order), so two people asking each other at once are paired, not stuck
  perform 1 from podcast_participants where id in (p_from, p_to) order by id for update;
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
language plpgsql set search_path = public, pg_temp as $$
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

-- ---------------------------------------------------------------- retention and "delete my data"

-- Run daily by the cron route. Returns how many rows each rule removed.
create function purge_old_data() returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_out jsonb := '{}';
  n int;
begin
  -- event registrations: 90 days after the event; cancelled ones after 30 days
  delete from event_registrations
   where event_date < current_date - 90 or (status = 'cancelled' and cancelled_at < now() - interval '30 days');
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('event_registrations', n);
  -- slots (with their bookings and volunteers): 90 days after the slot; cancelled slots after 30 days
  delete from digital_slots
   where slot_date < current_date - 90 or (status = 'cancelled' and cancelled_at < now() - interval '30 days');
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_slots', n);
  delete from digital_bookings where status = 'cancelled' and cancelled_at < now() - interval '30 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_bookings_cancelled', n);
  delete from digital_volunteers where status = 'cancelled' and cancelled_at < now() - interval '30 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_volunteers_cancelled', n);
  delete from digital_slot_series where until_date < current_date - 90;
  -- people who left the podcast: after 30 days
  delete from podcast_participants where not active and withdrawn_at < now() - interval '30 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('podcast_withdrawn', n);
  -- manual message queue: sent after 30 days, unsent after 90
  delete from outbound_messages
   where (status = 'sent' and sent_at < now() - interval '30 days') or created_at < now() - interval '90 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('outbound_messages', n);
  -- students who aren't signed in and have no place in a slot: 30 days after their last activity
  delete from students st
   where st.created_at < now() - interval '30 days'
     and not exists (select 1 from student_tokens t where t.student_id = st.id and t.expires_at > now())
     and not exists (select 1 from digital_volunteers v where v.student_id = st.id);
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('students_inactive', n);
  -- podcast sign-ups: one year after signing up
  delete from podcast_participants where created_at < now() - interval '365 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('podcast_old', n);
  delete from problem_reports where created_at < now() - interval '365 days';
  delete from audit_log where at < now() - interval '730 days';
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from student_tokens where expires_at < now();
  delete from code_lockouts where updated_at < now() - interval '1 day' and (locked_until is null or locked_until < now());
  return v_out;
end $$;

-- Admin: delete everything stored about one person, by phone and/or email. Returns counts.
create function delete_person_data(p_phone text, p_email text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_out jsonb := '{}';
  n int;
  v_email text := lower(nullif(trim(p_email), ''));
  v_phone text := nullif(trim(p_phone), '');
begin
  if v_phone is null and v_email is null then return v_out; end if;
  delete from event_registrations where phone = v_phone or lower(email) = v_email;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('event_registrations', n);
  delete from digital_bookings where phone = v_phone or lower(email) = v_email;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_bookings', n);
  delete from podcast_pairs where id in (
    select m.pair_id from podcast_pair_members m join podcast_participants p on p.id = m.participant_id
     where p.phone = v_phone or lower(p.email) = v_email);
  delete from podcast_participants where phone = v_phone or lower(email) = v_email;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('podcast_participants', n);
  delete from outbound_messages where to_phone = v_phone;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('outbound_messages', n);
  delete from students where lower(email) = v_email or phone = v_phone;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('students', n);
  -- the person as a student's parent or guardian: remove their details from that student
  update students set guardian_name = null, guardian_phone = null, guardian_confirmed_at = null, age_group = null
   where guardian_phone = v_phone;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('guardian_details', n);
  -- reports where they left their contact (students type it freely, so match inside the text)
  delete from problem_reports
   where (v_email is not null and position(v_email in lower(coalesce(contact, ''))) > 0)
      or (v_phone is not null and position(v_phone in regexp_replace(coalesce(contact, ''), '[^0-9+]', '', 'g')) > 0);
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('problem_reports', n);
  delete from code_lockouts where phone = v_phone;
  return v_out;
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
  -- Supabase's API roles (absent in plain Postgres; created by the tests to prove the rules).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
    execute 'revoke execute on all functions in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
    execute 'alter default privileges in schema public revoke execute on functions from anon, authenticated';
  end if;
end $$;
