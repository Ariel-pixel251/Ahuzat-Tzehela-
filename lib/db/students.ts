import { hashToken, newToken } from "../tokens";
import type { Db } from "./types";

export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  conduct_accepted_at: Date | null;
};

const LOGIN_TTL_MINUTES = 30;
const SESSION_TTL_DAYS = 90;
const MAX_LOGIN_LINKS_PER_15_MIN = 3;

/**
 * Finds or creates a student by email. An existing student's details are kept: anyone can type an
 * email address, so a sign-in request must not change someone else's name or phone.
 */
export async function upsertStudent(db: Db, input: { name: string; email: string; phone: string | null }) {
  const [row] = await db.query<Student>(
    `insert into students (name, email, phone) values ($1, $2, $3)
     on conflict (lower(email)) do update set phone = coalesce(students.phone, excluded.phone)
     returning id, name, email, phone, conduct_accepted_at`,
    [input.name, input.email, input.phone],
  );
  return row;
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
    `select s.id, s.name, s.email, s.phone, s.conduct_accepted_at
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
  db.query<Student>(`select id, name, email, phone, conduct_accepted_at from students order by name`);

export async function getStudent(db: Db, id: string) {
  const [row] = await db.query<Student>(`select id, name, email, phone, conduct_accepted_at from students where id = $1`, [id]);
  return row ?? null;
}
