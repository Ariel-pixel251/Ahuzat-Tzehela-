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
    m.body.slice(0, 2000),
  ]);

export const listMessages = (db: Db) =>
  db.query<OutboundMessage>(
    `select id, created_at, channel, to_phone, to_name, body, status from outbound_messages
      order by status desc, created_at desc limit 500`,
  );

export const markMessageSent = (db: Db, id: string) =>
  db.query(`update outbound_messages set status = 'sent', sent_at = now() where id = $1`, [id]);

// ---------------------------------------------------------------- 4-digit codes: lockout after 5 wrong tries

export const MAX_CODE_FAILURES = 5;
export const CODE_LOCK_HOURS = 24;

/**
 * Counts a code attempt for this phone BEFORE looking the code up (one atomic step, so parallel
 * requests can't slip past). False means locked: more than MAX_CODE_FAILURES tries without a right
 * code, for CODE_LOCK_HOURS. Call clearCodeFailures after a right code.
 */
export async function codeAttempt(db: Db, phone: string) {
  const [row] = await db.query<{ ok: boolean }>(`select code_attempt($1, $2::int, $3::int) as ok`, [phone, MAX_CODE_FAILURES, CODE_LOCK_HOURS]);
  return row.ok;
}

export const clearCodeFailures = (db: Db, phone: string) => db.query(`delete from code_lockouts where phone = $1`, [phone]);

// ---------------------------------------------------------------- status lookup by phone + code

export type StatusItem =
  | {
      type: "digital";
      status: string;
      slot_date: string;
      start_time: string;
      end_time: string;
      place_he: string;
      place_en: string | null;
      slot_status: string;
    }
  | { type: "event"; status: string; title_he: string; date: string; time: string | null }
  | { type: "podcast"; status: string };

/** What a resident sees on the status page. Needs both phone and code; never returns contact details. */
export async function lookupStatus(db: Db, phone: string, code: string): Promise<StatusItem[]> {
  const items: StatusItem[] = [];
  for (const r of await db.query<Omit<Extract<StatusItem, { type: "digital" }>, "type">>(
    `select b.status, to_char(s.slot_date, 'YYYY-MM-DD') as slot_date, s.start_time, s.end_time, s.place_he, s.place_en,
            s.status as slot_status
       from digital_bookings b join digital_slots s on s.id = b.slot_id
      where b.phone = $1 and b.code = $2`,
    [phone, code],
  ))
    items.push({ type: "digital", ...r });
  for (const r of await db.query<{ status: string; event_title_he: string; event_date: string; event_time: string | null }>(
    `select status, event_title_he, event_date, event_time from event_registration_list where phone = $1 and code = $2`,
    [phone, code],
  ))
    items.push({ type: "event", status: r.status, title_he: r.event_title_he, date: r.event_date, time: r.event_time });
  for (const r of await db.query<{ status: string }>(
    `select case when status = 'paired' then 'paired' else 'looking' end as status
       from podcast_people where phone = $1 and code = $2 and active`,
    [phone, code],
  ))
    items.push({ type: "podcast", status: r.status });
  return items;
}

// ---------------------------------------------------------------- problem reports

export type ProblemReport = {
  id: string;
  created_at: Date;
  portal: "student" | "resident";
  name: string | null;
  contact: string | null;
  message: string;
  status: "new" | "handled";
};

export const createProblemReport = (db: Db, r: Pick<ProblemReport, "portal" | "name" | "contact" | "message">) =>
  db.query(`insert into problem_reports (portal, name, contact, message) values ($1, $2, $3, $4)`, [
    r.portal,
    r.name,
    r.contact,
    r.message,
  ]);

export const listProblemReports = (db: Db) =>
  db.query<ProblemReport>(
    `select id, created_at, portal, name, contact, message, status from problem_reports order by status, created_at desc`,
  );

export const markReportHandled = (db: Db, id: string) =>
  db.query(`update problem_reports set status = 'handled', handled_at = now() where id = $1`, [id]);

// ---------------------------------------------------------------- blocked people

export type BlockedContact = { id: string; created_at: Date; kind: "phone" | "email"; value: string; reason: string | null; blocked_by: string };

export const listBlocked = (db: Db) =>
  db.query<BlockedContact>(`select id, created_at, kind, value, reason, blocked_by from blocked_contacts order by created_at desc`);

export const blockContact = (db: Db, b: { kind: "phone" | "email"; value: string; reason: string | null; blocked_by: string }) =>
  db.query(
    `insert into blocked_contacts (kind, value, reason, blocked_by) values ($1, $2, $3, $4)
     on conflict (kind, value) do update set reason = excluded.reason, blocked_by = excluded.blocked_by`,
    [b.kind, b.kind === "email" ? b.value.toLowerCase() : b.value, b.reason, b.blocked_by],
  );

export const unblockContact = (db: Db, id: string) => db.query(`delete from blocked_contacts where id = $1`, [id]);

/** True if the phone or email (either may be missing) was blocked by an admin. */
export async function isBlocked(db: Db, phone: string | null | undefined, email: string | null | undefined) {
  if (!phone && !email) return false;
  const [row] = await db.query<{ blocked: boolean }>(
    `select exists (select 1 from blocked_contacts
                     where (kind = 'phone' and value = $1) or (kind = 'email' and value = lower($2))) as blocked`,
    [phone ?? null, email ?? null],
  );
  return row.blocked;
}

// ---------------------------------------------------------------- audit log

export type AuditEntry = { id: number; at: Date; actor: string; action: string; target: string | null; details: unknown };

/** Records who did what in the admin area. Never pass phone numbers or emails of members of the public. */
export const audit = (db: Db, actor: string, action: string, target: string | null = null, details: unknown = null) =>
  db.query(`insert into audit_log (actor, action, target, details) values ($1, $2, $3, $4::text::jsonb)`, [
    actor.slice(0, 200),
    action.slice(0, 100),
    target?.slice(0, 200) ?? null,
    JSON.stringify(details),
  ]);

export const listAudit = (db: Db, limit = 300) =>
  db.query<AuditEntry>(`select id, at, actor, action, target, details from audit_log order by at desc limit $1::int`, [limit]);

// ---------------------------------------------------------------- retention and deletion

export async function purgeOldData(db: Db) {
  const [row] = await db.query<{ result: Record<string, number> }>(`select purge_old_data() as result`);
  return row.result;
}

/** Deletes everything stored about one person (by phone and/or email). Returns counts per table. */
export async function deletePersonData(db: Db, phone: string | null, email: string | null) {
  const [row] = await db.query<{ result: Record<string, number> }>(`select delete_person_data($1, $2) as result`, [phone, email]);
  return row.result;
}
