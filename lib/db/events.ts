import { hashToken, newCode, newToken } from "../tokens";
import type { Db } from "./types";

export type Portal = "student" | "resident";
export type RegistrationKind = "general" | "language-night" | "game-night";
export type RegistrationStatus = "confirmed" | "waitlist" | "cancelled";

export type RegistrationInput = {
  event_key: string;
  event_title_en: string;
  event_title_he: string;
  event_date: string;
  event_time: string | null;
  kind: RegistrationKind;
  portal: Portal;
  name: string;
  phone: string | null;
  email: string | null;
  attendees: number;
  notes: string | null;
  languages: string[];
  other_language: string | null;
  preferred_language: string | null;
  registered_by: string | null;
};

export type Registration = RegistrationInput & {
  id: string;
  created_at: Date;
  status: RegistrationStatus;
  code: string;
  reminder_sent_for: string | null;
  cancel_notice_sent_at: Date | null;
};

export type RegisterResult =
  | { status: "confirmed" | "waitlist"; id: string; code: string; token: string | null }
  | { status: "duplicate" };

/**
 * Registers for a calendar event. With a capacity, people beyond it go on the waiting list.
 * An edit link token is created only when there is an email to send it to.
 */
export async function registerForEvent(db: Db, input: RegistrationInput, capacity: number | null): Promise<RegisterResult> {
  const code = newCode();
  const token = input.email ? newToken() : null;
  const [row] = await db.query<{ r_id: string | null; r_status: string }>(
    `select r_id, r_status from register_for_event($1::text::jsonb, $2::int)`,
    [JSON.stringify({ ...input, code, manage_token_hash: token?.hash ?? null }), capacity],
  );
  if (row.r_status === "duplicate" || !row.r_id) return { status: "duplicate" };
  return { status: row.r_status as "confirmed" | "waitlist", id: row.r_id, code, token: token?.raw ?? null };
}

/** Cancels and promotes from the waiting list. Returns the promoted registrations. */
export async function cancelRegistration(db: Db, id: string, capacity: number | null) {
  const promoted = await db.query<{ id: string }>(
    `select cancel_event_registration($1::uuid, $2::int) as id`,
    [id, capacity],
  );
  const ids = promoted.map((p) => p.id).filter(Boolean);
  if (!ids.length) return [];
  return db.query<Registration>(`select * from event_registration_list where id = any(text_array($1::text::jsonb)::uuid[])`, [
    JSON.stringify(ids),
  ]);
}

/** Moves people up from the waiting list while they fit. Returns the promoted registrations. */
export async function promoteWaitlist(db: Db, eventKey: string, capacity: number) {
  const promoted = await db.query<{ id: string }>(`select promote_waitlist($1, $2::int) as id`, [eventKey, capacity]);
  const ids = promoted.map((p) => p.id).filter(Boolean);
  if (!ids.length) return [];
  return db.query<Registration>(`select * from event_registration_list where id = any(text_array($1::text::jsonb)::uuid[])`, [
    JSON.stringify(ids),
  ]);
}

export async function getRegistrationByToken(db: Db, rawToken: string) {
  const [row] = await db.query<Registration>(`select * from event_registration_list where manage_token_hash = $1`, [
    hashToken(rawToken),
  ]);
  return row ?? null;
}

export async function getRegistration(db: Db, id: string) {
  const [row] = await db.query<Registration>(`select * from event_registration_list where id = $1`, [id]);
  return row ?? null;
}

export const listRegistrations = (db: Db) =>
  db.query<Registration>(`select * from event_registration_list order by event_date desc, event_key, created_at`);

export const listRegistrationsForEvent = (db: Db, eventKey: string) =>
  db.query<Registration>(
    `select * from event_registration_list where event_key = $1 and status <> 'cancelled' order by created_at`,
    [eventKey],
  );

/** Confirmed attendees per event key, for showing "places left". */
export async function confirmedCounts(db: Db, eventKeys: string[]) {
  if (!eventKeys.length) return new Map<string, number>();
  const rows = await db.query<{ event_key: string; n: number }>(
    `select event_key, coalesce(sum(attendees), 0)::int as n from event_registrations
      where status = 'confirmed' and event_key = any(text_array($1::text::jsonb)) group by event_key`,
    [JSON.stringify(eventKeys)],
  );
  return new Map(rows.map((r) => [r.event_key, r.n]));
}

/** Registrations that still need a reminder for this event occurrence ("date time"). */
export const listNeedingReminder = (db: Db, eventKey: string, occurrence: string) =>
  db.query<Registration>(
    `select * from event_registration_list
      where event_key = $1 and status = 'confirmed' and reminder_sent_for is distinct from $2`,
    [eventKey, occurrence],
  );

export const markReminderSent = (db: Db, id: string, occurrence: string) =>
  db.query(`update event_registrations set reminder_sent_for = $2 where id = $1`, [id, occurrence]);

export const markCancelNoticeSent = (db: Db, eventKey: string) =>
  db.query(`update event_registrations set cancel_notice_sent_at = now() where event_key = $1 and status <> 'cancelled'`, [
    eventKey,
  ]);

/** A signed-in student's own registrations (matched by their email). */
export const listMyEventRegistrations = (db: Db, email: string) =>
  db.query<Registration>(
    `select * from event_registration_list
      where lower(email) = lower($1) and event_date::date >= current_date - 7
      order by event_date, event_time`,
    [email],
  );
