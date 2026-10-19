-- סכמת מסד הנתונים להרשמות. להריץ ב-Supabase → SQL Editor.
-- האתר כותב עם מפתח anon, לכן ה-RLS מאפשר רק INSERT ולא קריאה.

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('project', 'event', 'lesson')),
  full_name text not null check (char_length(full_name) between 1 and 100),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 30),
  project_slug text,
  event_id text,
  lesson_topic text check (char_length(lesson_topic) <= 200),
  lesson_role text check (lesson_role in ('learn', 'teach')),
  notes text check (char_length(notes) <= 1000),
  check (
    (kind = 'project' and project_slug is not null) or
    (kind = 'event' and event_id is not null) or
    (kind = 'lesson' and lesson_topic is not null and lesson_role is not null)
  )
);

create table if not exists public.lecture_proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 1 and 100),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 30),
  title text not null check (char_length(title) <= 200),
  language text check (char_length(language) <= 50),
  description text check (char_length(description) <= 1000)
);

alter table public.signups enable row level security;
alter table public.lecture_proposals enable row level security;

drop policy if exists "anon can insert signups" on public.signups;
create policy "anon can insert signups" on public.signups
  for insert to anon with check (true);

drop policy if exists "anon can insert lecture proposals" on public.lecture_proposals;
create policy "anon can insert lecture proposals" on public.lecture_proposals
  for insert to anon with check (true);
