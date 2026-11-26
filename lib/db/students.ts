import type { Db } from "./types";

export type Student = {
  id: string;
  name: string;
  /** null for a student an admin added without an email */
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

/**
 * Finds or creates a student by email (the sign-up card on the slot). The school email is the only
 * identity check, so the latest sign-up's name is used, and a phone number already given is kept.
 */
export async function upsertStudent(db: Db, input: { name: string; email: string; phone: string | null }) {
  const [row] = await db.query<Student>(
    `insert into students (name, email, phone) values ($1, $2, $3)
     on conflict (lower(email)) do update set
       name = excluded.name,
       phone = coalesce(excluded.phone, students.phone)
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

/** Blocking: removes any old sign-in sessions and cancels their places in upcoming slots. */
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

/** From the sign-up card: age group, and a parent or guardian for under-18s. */
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
