import { newCode } from "../tokens";
import type { Portal } from "./events";
import type { Db } from "./types";

// ---------------------------------------------------------------- rate limiting

/** True while `key` is under `max` hits in the current window. */
export async function hitRateLimit(db: Db, key: string, max: number, windowSeconds: number) {
  const [row] = await db.query<{ ok: boolean }>(`select hit_rate_limit($1, $2::int, $3::int) as ok`, [key, max, windowSeconds]);
  return row.ok;
}

// ---------------------------------------------------------------- settings

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const [row] = await db.query<{ value: T }>(`select value from settings where key = $1`, [key]);
  return row ? row.value : fallback;
}

export const setSetting = (db: Db, key: string, value: unknown) =>
  db.query(
    `insert into settings (key, value) values ($1, $2::text::jsonb) on conflict (key) do update set value = excluded.value`,
    [key, JSON.stringify(value)],
  );

// ---------------------------------------------------------------- outbound (manual SMS/WhatsApp) queue

export type OutboundMessage = {
  id: string;
  created_at: Date;
  channel: "sms" | "whatsapp";
  to_phone: string;
  to_name: string | null;
  body: string;
  status: "pending" | "sent";
};

export const queueMessage = (db: Db, m: { channel: "sms" | "whatsapp"; to_phone: string; to_name: string | null; body: string }) =>
  db.query(`insert into outbound_messages (channel, to_phone, to_name, body) values ($1, $2, $3, $4)`, [
    m.channel,
    m.to_phone,
    m.to_name,
    m.body,
  ]);

export const listMessages = (db: Db) =>
  db.query<OutboundMessage>(`select * from outbound_messages order by status desc, created_at desc limit 500`);

export const markMessageSent = (db: Db, id: string) =>
  db.query(`update outbound_messages set status = 'sent', sent_at = now() where id = $1`, [id]);

// ---------------------------------------------------------------- lessons

export type LessonTopic = { id: string; name_en: string; name_he: string; active: boolean; sort: number };

export const listLessonTopics = (db: Db, activeOnly = true) =>
  db.query<LessonTopic>(`select * from lesson_topics ${activeOnly ? "where active" : ""} order by sort, name_en`);

export const addLessonTopic = (db: Db, t: { name_en: string; name_he: string }) =>
  db.query(`insert into lesson_topics (name_en, name_he, sort) values ($1, $2, (select coalesce(max(sort), 0) + 1 from lesson_topics))`, [
    t.name_en,
    t.name_he,
  ]);

export const toggleLessonTopic = (db: Db, id: string) =>
  db.query(`update lesson_topics set active = not active where id = $1`, [id]);

export type LessonInput = {
  role: "learn" | "teach";
  portal: Portal;
  name: string;
  phone: string | null;
  email: string | null;
  topics: string[];
  other_topic: string | null;
  notes: string | null;
  registered_by: string | null;
};
export type LessonRequest = LessonInput & { id: string; created_at: Date; status: string; code: string };

export async function createLessonRequest(db: Db, input: LessonInput) {
  const code = newCode();
  const [row] = await db.query<{ id: string }>(
    `insert into lesson_requests (role, portal, name, phone, email, topics, other_topic, notes, registered_by, code)
     values ($1, $2, $3, $4, $5, text_array($6::text::jsonb), $7, $8, $9, $10) returning id`,
    [
      input.role,
      input.portal,
      input.name,
      input.phone,
      input.email,
      JSON.stringify(input.topics),
      input.other_topic,
      input.notes,
      input.registered_by,
      code,
    ],
  );
  return { id: row.id, code };
}

export const listLessonRequests = (db: Db) =>
  db.query<LessonRequest>(`select * from lesson_requests order by created_at desc`);

export const listLessonMatches = (db: Db) =>
  db.query<{ id: string; learner_id: string; teacher_id: string; topic: string | null }>(
    `select id, learner_id, teacher_id, topic from lesson_matches order by created_at desc`,
  );

/** Matches a learner with a teacher. Returns false if the learner already has a match. */
export async function matchLesson(db: Db, learnerId: string, teacherId: string, topic: string | null) {
  const rows = await db.query(
    `insert into lesson_matches (learner_id, teacher_id, topic)
     select $1, $2, $3
      where exists (select 1 from lesson_requests where id = $1 and role = 'learn' and status = 'open')
        and exists (select 1 from lesson_requests where id = $2 and role = 'teach')
     on conflict (learner_id) do nothing returning id`,
    [learnerId, teacherId, topic],
  );
  if (!rows.length) return false;
  await db.query(`update lesson_requests set status = 'matched' where id = $1`, [learnerId]);
  return true;
}

export async function unmatchLesson(db: Db, matchId: string) {
  await db.query(
    `with m as (delete from lesson_matches where id = $1 returning learner_id)
     update lesson_requests set status = 'open' where id in (select learner_id from m)`,
    [matchId],
  );
}

// ---------------------------------------------------------------- lecture proposals, visits, callbacks

export type LectureInput = {
  name: string;
  phone: string;
  email: string | null;
  topic: string;
  language: string;
  preferred_date: string | null;
  description: string | null;
  registered_by: string | null;
};

export async function createLectureProposal(db: Db, input: LectureInput) {
  const code = newCode();
  await db.query(
    `insert into lecture_proposals (name, phone, email, topic, language, preferred_date, description, registered_by, code)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [input.name, input.phone, input.email, input.topic, input.language, input.preferred_date, input.description, input.registered_by, code],
  );
  return { code };
}

export const listLectureProposals = (db: Db) =>
  db.query<LectureInput & { id: string; created_at: Date; status: string; code: string }>(
    `select * from lecture_proposals order by created_at desc`,
  );

export type VisitInput = {
  name: string;
  organization: string | null;
  email: string;
  phone: string | null;
  preferred_dates: string | null;
  group_size: number | null;
  notes: string | null;
};

export const createVisitRequest = (db: Db, v: VisitInput) =>
  db.query(
    `insert into visit_requests (name, organization, email, phone, preferred_dates, group_size, notes)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [v.name, v.organization, v.email, v.phone, v.preferred_dates, v.group_size, v.notes],
  );

export const listVisitRequests = (db: Db) =>
  db.query<VisitInput & { id: string; created_at: Date; status: string }>(`select * from visit_requests order by created_at desc`);

export const createCallback = (db: Db, c: { name: string; phone: string; registered_by: string | null }) =>
  db.query(`insert into callback_requests (name, phone, registered_by) values ($1, $2, $3)`, [c.name, c.phone, c.registered_by]);

export const listCallbacks = (db: Db) =>
  db.query<{ id: string; created_at: Date; name: string; phone: string; handled: boolean; registered_by: string | null }>(
    `select * from callback_requests order by handled, created_at desc`,
  );

export const toggleCallbackHandled = (db: Db, id: string) =>
  db.query(
    `update callback_requests set handled = not handled, handled_at = case when handled then null else now() end where id = $1`,
    [id],
  );

/** Admin status changes for simple review lists. */
const STATUS_TABLES = {
  lecture: { table: "lecture_proposals", statuses: ["new", "accepted", "declined"] },
  visit: { table: "visit_requests", statuses: ["new", "scheduled", "declined"] },
  lesson: { table: "lesson_requests", statuses: ["open", "matched", "closed"] },
} as const;

export async function setReviewStatus(db: Db, kind: keyof typeof STATUS_TABLES, id: string, status: string) {
  const { table, statuses } = STATUS_TABLES[kind];
  if (!(statuses as readonly string[]).includes(status)) return false;
  const rows = await db.query(`update ${table} set status = $2 where id = $1 returning id`, [id, status]);
  return rows.length === 1;
}

// ---------------------------------------------------------------- status lookup by phone + code

export type StatusItem =
  | { type: "digital"; status: string; volunteer_first_name: string | null; approved: boolean }
  | { type: "event"; status: string; title_he: string; date: string; time: string | null }
  | { type: "podcast"; status: string }
  | { type: "lecture"; status: string; topic: string }
  | { type: "lesson"; status: string };

/** What a resident sees on the status page. Needs both phone and code; never returns contact details. */
export async function lookupStatus(db: Db, phone: string, code: string): Promise<StatusItem[]> {
  const items: StatusItem[] = [];
  for (const r of await db.query<{ status: string; first_name: string | null; approved: boolean }>(
    `select r.status, split_part(trim(s.name), ' ', 1) as first_name, r.approved_at is not null as approved
       from digital_requests r left join students s on s.id = r.student_id
      where r.resident_phone = $1 and r.code = $2`,
    [phone, code],
  ))
    items.push({ type: "digital", status: r.status, volunteer_first_name: r.approved ? r.first_name : null, approved: r.approved });
  for (const r of await db.query<{ status: string; event_title_he: string; event_date: string; event_time: string | null }>(
    `select status, event_title_he, to_char(event_date, 'YYYY-MM-DD') as event_date, event_time
       from event_registrations where phone = $1 and code = $2`,
    [phone, code],
  ))
    items.push({ type: "event", status: r.status, title_he: r.event_title_he, date: r.event_date, time: r.event_time });
  for (const r of await db.query<{ status: string }>(
    `select case when exists (select 1 from podcast_pair_members m where m.participant_id = p.id) then 'paired' else 'looking' end as status
       from podcast_participants p where p.phone = $1 and p.code = $2 and p.active`,
    [phone, code],
  ))
    items.push({ type: "podcast", status: r.status });
  for (const r of await db.query<{ status: string; topic: string }>(
    `select status, topic from lecture_proposals where phone = $1 and code = $2`,
    [phone, code],
  ))
    items.push({ type: "lecture", status: r.status, topic: r.topic });
  for (const r of await db.query<{ status: string }>(`select status from lesson_requests where phone = $1 and code = $2`, [phone, code]))
    items.push({ type: "lesson", status: r.status });
  return items;
}

// ---------------------------------------------------------------- courses, timetable, announcements

export type Course = {
  id: string;
  title_en: string;
  title_he: string;
  description_en: string | null;
  description_he: string | null;
  active: boolean;
  sort: number;
};
export type Slot = {
  id: string;
  day: number;
  start_time: string;
  end_time: string | null;
  title_en: string;
  title_he: string;
  location_en: string | null;
  location_he: string | null;
};
export type Announcement = { id: string; text_en: string; text_he: string; active: boolean; expires_on: string | null };

export const listCourses = (db: Db, activeOnly = true) =>
  db.query<Course>(`select * from courses ${activeOnly ? "where active" : ""} order by sort, title_en`);

export const addCourse = (db: Db, c: Omit<Course, "id" | "active" | "sort">) =>
  db.query(
    `insert into courses (title_en, title_he, description_en, description_he, sort)
     values ($1, $2, $3, $4, (select coalesce(max(sort), 0) + 1 from courses))`,
    [c.title_en, c.title_he, c.description_en, c.description_he],
  );

export const deleteCourse = (db: Db, id: string) => db.query(`delete from courses where id = $1`, [id]);

export const listSlots = (db: Db) => db.query<Slot>(`select * from timetable_slots order by day, start_time`);

export const addSlot = (db: Db, s: Omit<Slot, "id">) =>
  db.query(
    `insert into timetable_slots (day, start_time, end_time, title_en, title_he, location_en, location_he)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [s.day, s.start_time, s.end_time, s.title_en, s.title_he, s.location_en, s.location_he],
  );

export const deleteSlot = (db: Db, id: string) => db.query(`delete from timetable_slots where id = $1`, [id]);

/** Active, unexpired announcements (Israel date). */
export const listActiveAnnouncements = (db: Db) =>
  db.query<Announcement>(
    `select id, text_en, text_he, active, to_char(expires_on, 'YYYY-MM-DD') as expires_on from announcements
      where active and (expires_on is null or expires_on >= (now() at time zone 'Asia/Jerusalem')::date)
      order by created_at desc`,
  );

export const listAnnouncements = (db: Db) =>
  db.query<Announcement>(
    `select id, text_en, text_he, active, to_char(expires_on, 'YYYY-MM-DD') as expires_on from announcements order by created_at desc`,
  );

export const addAnnouncement = (db: Db, a: { text_en: string; text_he: string; expires_on: string | null }) =>
  db.query(`insert into announcements (text_en, text_he, expires_on) values ($1, $2, $3)`, [a.text_en, a.text_he, a.expires_on]);

export const toggleAnnouncement = (db: Db, id: string) =>
  db.query(`update announcements set active = not active where id = $1`, [id]);

export const deleteAnnouncement = (db: Db, id: string) => db.query(`delete from announcements where id = $1`, [id]);
