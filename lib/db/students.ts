import { hashToken, newToken } from "../tokens";
import type { Db } from "./types";

export type Student = {
  id: string;
  name: string;
  /** null for a student an admin added without an email (they can't sign in) */
  email: string | null;
  phone: string | null;
  age_group: "under-18" | "18-plus" | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_confirmed_at: Date | null;
  conduct_accepted_at: Date | null;
};

export type StudentProfile = {
  phone: string | null;
  age_group: "under-18" | "18-plus";
  guardian_name: string | null;
  guardian_phone: string | null;
};

/** Can volunteer: age group given, and a parent or guardian's details and okay for under-18s. */
export const profileComplete = (s: Student) =>
  s.age_group === "18-plus" || (s.age_group === "under-18" && Boolean(s.guardian_name && s.guardian_phone && s.guardian_confirmed_at));

const LOGIN_TTL_MINUTES = 30;
const SESSION_TTL_DAYS = 30;
const MAX_LOGIN_LINKS_PER_15_MIN = 3;

/**
 * Finds or creates a student by email. Anyone can type an email address, so the details of a
 * student who has signed in (proved the inbox) are kept; until then the latest request's name and
 * phone are used, so nobody can fix a classmate's name by asking for a link first.
 */
export async function upsertStudent(db: Db, input: { name: string; email: string; phone: string | null }) {
  const [row] = await db.query<Student>(
    `insert into students (name, email, phone) values ($1, $2, $3)
     on conflict (lower(email)) do update set
       name = case when students.verified_at is null then excluded.name else students.name end,
       phone = case when students.verified_at is null then excluded.phone else coalesce(students.phone, excluded.phone) end
     returning id, name, email, phone, age_group, guardian_name, guardian_phone, guardian_confirmed_at, conduct_accepted_at`,
    [input.name, input.email, input.phone],
  );
  return row;
}

/**
 * An admin adds a student who hasn't signed up (for example to put them in a slot). With an email,
 * an existing student with that email is reused (their details are kept); without one, a new
 * student is created who can't sign in.
 */
export async function addStudentByAdmin(db: Db, input: { name: string; email: string | null; phone: string | null; added_by: string }) {
  if (input.email) {
    const [row] = await db.query<{ id: string }>(
      `insert into students (name, email, phone, added_by) values ($1, $2, $3, $4)
       on conflict (lower(email)) do update set phone = coalesce(students.phone, excluded.phone)
       returning id`,
      [input.name, input.email, input.phone, input.added_by],
    );
    return row.id;
  }
  const [row] = await db.query<{ id: string }>(`insert into students (name, phone, added_by) values ($1, $2, $3) returning id`, [
    input.name,
    input.phone,
    input.added_by,
  ]);
  return row.id;
}

/** A single-use sign-in token, or null if too many were requested recently. */
export async function createLoginToken(db: Db, studentId: string) {
  const [{ n }] = await db.query<{ n: number }>(
    `select count(*)::int as n from student_tokens
      where student_id = $1 and kind = 'login' and created_at > now() - interval '15 minutes'`,
    [studentId],
  );
  if (n >= MAX_LOGIN_LINKS_PER_15_MIN) return null;
  const token = newToken();
  await db.query(
    `insert into student_tokens (token_hash, student_id, kind, expires_at)
     values ($1, $2, 'login', now() + make_interval(mins => $3::int))`,
    [token.hash, studentId, LOGIN_TTL_MINUTES],
  );
  return token.raw;
}

/** Trades a valid, unused login token for a session token. */
export async function exchangeLoginToken(db: Db, rawLoginToken: string) {
  const rows = await db.query<{ student_id: string }>(
    `update student_tokens set used_at = now()
      where token_hash = $1 and kind = 'login' and used_at is null and expires_at > now()
      returning student_id`,
    [hashToken(rawLoginToken)],
  );
  if (!rows[0]) return null;
  await db.query(`update students set verified_at = coalesce(verified_at, now()) where id = $1`, [rows[0].student_id]);
  const session = newToken();
  await db.query(
    `insert into student_tokens (token_hash, student_id, kind, expires_at)
     values ($1, $2, 'session', now() + make_interval(days => $3::int))`,
    [session.hash, rows[0].student_id, SESSION_TTL_DAYS],
  );
  return { token: session.raw, maxAgeSeconds: SESSION_TTL_DAYS * 24 * 3600 };
}

export async function getStudentBySession(db: Db, rawSessionToken: string) {
  const [row] = await db.query<Student>(
    `select s.id, s.name, s.email, s.phone, s.age_group, s.guardian_name, s.guardian_phone, s.guardian_confirmed_at,
            s.conduct_accepted_at
       from student_tokens t join students s on s.id = t.student_id
      where t.token_hash = $1 and t.kind = 'session' and t.expires_at > now()`,
    [hashToken(rawSessionToken)],
  );
  return row ?? null;
}

export const deleteSession = (db: Db, rawSessionToken: string) =>
  db.query(`delete from student_tokens where token_hash = $1 and kind = 'session'`, [hashToken(rawSessionToken)]);

export const acceptConduct = (db: Db, studentId: string) =>
  db.query(`update students set conduct_accepted_at = coalesce(conduct_accepted_at, now()) where id = $1`, [studentId]);

export const listStudents = (db: Db) =>
  db.query<Student>(
    `select id, name, email, phone, age_group, guardian_name, guardian_phone, guardian_confirmed_at, conduct_accepted_at
       from students order by name`,
  );

export async function getStudent(db: Db, id: string) {
  const [row] = await db.query<Student>(
    `select id, name, email, phone, age_group, guardian_name, guardian_phone, guardian_confirmed_at, conduct_accepted_at
       from students where id = $1`,
    [id],
  );
  return row ?? null;
}

/** Blocking: signs the student out everywhere and cancels their places in upcoming slots. */
export async function revokeStudent(db: Db, by: { email: string | null; phone: string | null }) {
  const ids = (
    await db.query<{ id: string }>(`select id from students where lower(email) = lower($1) or phone = $2`, [by.email, by.phone])
  ).map((r) => r.id);
  for (const id of ids) {
    await db.query(`delete from student_tokens where student_id = $1`, [id]);
    await db.query(
      `update digital_volunteers set status = 'cancelled', cancelled_at = now() where student_id = $1 and status <> 'cancelled'`,
      [id],
    );
  }
  return ids.length;
}

/** The student's own profile (age group, and a parent or guardian for under-18s). */
export const saveProfile = (db: Db, id: string, p: StudentProfile) =>
  db.query(
    `update students
        set phone = coalesce($2, phone), age_group = $3::text,
            guardian_name = case when $3::text = 'under-18' then $4 end,
            guardian_phone = case when $3::text = 'under-18' then $5 end,
            guardian_confirmed_at = case when $3::text = 'under-18' then now() end
      where id = $1`,
    [id, p.phone, p.age_group, p.guardian_name, p.guardian_phone],
  );
