import { hashToken, newCode, newToken } from "../tokens";
import type { Db } from "./types";

// Digital support: admin-set time slots, residents' bookings and student volunteers.

export type SlotStatus = "scheduled" | "cancelled";

export type SlotInput = {
  slot_date: string;
  start_time: string;
  end_time: string;
  place_he: string;
  place_en: string | null;
  resident_places: number;
  helpers_needed: number;
  note_en: string | null;
  note_he: string | null;
  booking_open: boolean;
  closes_hours_before: number | null;
};

export type Slot = SlotInput & {
  id: string;
  series_id: string | null;
  status: SlotStatus;
  updated_at: Date;
  starts_at: Date;
  ends_at: Date;
  closes_at: Date;
  /** confirmed resident bookings */
  booked: number;
  /** student helpers (pending or confirmed) */
  helpers: number;
};

/** Hours before a slot from which its volunteers see the residents' phone numbers. */
export const CONTACT_WINDOW_HOURS = 48;
/** Weekly series are capped, so a typo in "until" can't create hundreds of slots. */
export const MAX_SERIES_OCCURRENCES = 60;

export const freePlaces = (s: Pick<Slot, "resident_places" | "booked">) => Math.max(0, s.resident_places - s.booked);

/** Open for residents to book right now (the database checks again when booking). */
export function bookable(s: Slot, now = new Date()) {
  return s.status === "scheduled" && s.booking_open && s.closes_at > now && freePlaces(s) > 0;
}

// ---------------------------------------------------------------- slots

/** Slots that haven't ended yet, cancelled ones included (the pages decide what to show). */
export const listUpcomingSlots = (db: Db) =>
  db.query<Slot>(`select * from digital_slot_overview where ends_at > now() order by slot_date, start_time`);

/** For the admin page: upcoming slots and those of the last 30 days. */
export const listSlotsForAdmin = (db: Db) =>
  db.query<Slot>(
    `select * from digital_slot_overview where slot_date::date >= current_date - 30 order by slot_date, start_time`,
  );

export async function getSlot(db: Db, id: string) {
  const [row] = await db.query<Slot>(`select * from digital_slot_overview where id = $1`, [id]);
  return row ?? null;
}

export async function createSlot(db: Db, s: SlotInput, seriesId: string | null = null) {
  const rows = await db.query<{ id: string }>(
    `insert into digital_slots (series_id, slot_date, start_time, end_time, place_he, place_en, resident_places,
                                helpers_needed, note_en, note_he, booking_open, closes_hours_before)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict do nothing returning id`,
    [
      seriesId,
      s.slot_date,
      s.start_time,
      s.end_time,
      s.place_he,
      s.place_en,
      s.resident_places,
      s.helpers_needed,
      s.note_en,
      s.note_he,
      s.booking_open,
      s.closes_hours_before,
    ],
  );
  return rows[0]?.id ?? null;
}

/** The dates of a weekly series: every 7 days from the first date until (and including) `until`. */
export function weeklyDates(first: string, until: string, skip: ReadonlySet<string> = new Set()) {
  const dates: string[] = [];
  const end = Date.parse(`${until}T00:00:00Z`);
  for (let t = Date.parse(`${first}T00:00:00Z`); t <= end && dates.length < MAX_SERIES_OCCURRENCES; t += 7 * 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (!skip.has(d)) dates.push(d);
  }
  return dates;
}

/** Creates a weekly series and one slot per week, skipping blocked dates. Returns the slot count. */
export async function createSeries(db: Db, first: SlotInput, until: string, createdBy: string) {
  const [series] = await db.query<{ id: string }>(
    `insert into digital_slot_series (first_date, until_date, start_time, end_time, created_by)
     values ($1, $2, $3, $4, $5) returning id`,
    [first.slot_date, until, first.start_time, first.end_time, createdBy],
  );
  const blocked = new Set((await listBlockedDates(db)).map((b) => b.day));
  let created = 0;
  for (const date of weeklyDates(first.slot_date, until, blocked)) {
    if (await createSlot(db, { ...first, slot_date: date }, series.id)) created++;
  }
  return { seriesId: series.id, created };
}

/** Edits one slot. Returns the slot before the change (to tell people if the time or place moved). */
export async function updateSlot(db: Db, id: string, s: SlotInput) {
  const before = await getSlot(db, id);
  if (!before || before.status !== "scheduled") return null;
  await db.query(
    `update digital_slots
        set slot_date = $2, start_time = $3, end_time = $4, place_he = $5, place_en = $6, resident_places = $7,
            helpers_needed = $8, note_en = $9, note_he = $10, booking_open = $11, closes_hours_before = $12,
            updated_at = now()
      where id = $1 and status = 'scheduled'`,
    [
      id,
      s.slot_date,
      s.start_time,
      s.end_time,
      s.place_he,
      s.place_en,
      s.resident_places,
      s.helpers_needed,
      s.note_en,
      s.note_he,
      s.booking_open,
      s.closes_hours_before,
    ],
  );
  return before;
}

export const setBookingOpen = (db: Db, id: string, open: boolean) =>
  db.query(`update digital_slots set booking_open = $2, updated_at = now() where id = $1 and status = 'scheduled'`, [id, open]);

/** Cancels a slot with its bookings and volunteers. Returns false if it was already cancelled. */
export async function cancelSlot(db: Db, id: string) {
  const rows = await db.query(
    `update digital_slots set status = 'cancelled', cancelled_at = now(), updated_at = now()
      where id = $1 and status = 'scheduled' returning id`,
    [id],
  );
  if (!rows.length) return false;
  await db.query(`update digital_bookings set status = 'cancelled', cancelled_at = now() where slot_id = $1 and status = 'confirmed'`, [id]);
  await db.query(
    `update digital_volunteers set status = 'cancelled', cancelled_at = now() where slot_id = $1 and status <> 'cancelled'`,
    [id],
  );
  return true;
}

/** Ids of a series' scheduled slots from a date on (to cancel the rest of a series). */
export const listSeriesSlotIds = (db: Db, seriesId: string, fromDate: string) =>
  db.query<{ id: string }>(
    `select id from digital_slots where series_id = $1 and slot_date >= $2::date and status = 'scheduled' order by slot_date`,
    [seriesId, fromDate],
  );

// ---------------------------------------------------------------- blocked dates (holidays)

export const listBlockedDates = (db: Db) =>
  db.query<{ day: string; reason: string | null }>(
    `select to_char(day, 'YYYY-MM-DD') as day, reason from digital_blocked_dates order by day`,
  );

export const addBlockedDate = (db: Db, day: string, reason: string | null) =>
  db.query(`insert into digital_blocked_dates (day, reason) values ($1, $2) on conflict (day) do update set reason = excluded.reason`, [
    day,
    reason,
  ]);

export const removeBlockedDate = (db: Db, day: string) => db.query(`delete from digital_blocked_dates where day = $1`, [day]);

/** Scheduled slots on a date (to cancel them when the date is blocked). */
export const listSlotIdsOn = (db: Db, day: string) =>
  db.query<{ id: string }>(`select id from digital_slots where slot_date = $1::date and status = 'scheduled'`, [day]);

// ---------------------------------------------------------------- resident bookings

export type BookingInput = {
  name: string;
  phone: string;
  email: string | null;
  needs: string[];
  needs_other: string | null;
  registered_by: string | null;
};

export type Booking = BookingInput & {
  id: string;
  created_at: Date;
  slot_id: string;
  status: "confirmed" | "cancelled";
  code: string;
};

export type BookResult =
  | { status: "booked"; id: string; code: string; token: string | null }
  | { status: "not_found" | "closed" | "full" | "duplicate" };

/** Books a place atomically (see book_digital_slot). An edit-link token only when there's an email. */
export async function bookSlot(db: Db, slotId: string, input: BookingInput, { staff = false } = {}): Promise<BookResult> {
  const code = newCode();
  const token = input.email ? newToken() : null;
  const [row] = await db.query<{ r_id: string | null; r_status: string }>(
    `select r_id, r_status from book_digital_slot($1::uuid, $2::text::jsonb, $3)`,
    [slotId, JSON.stringify({ ...input, code, manage_token_hash: token?.hash ?? null }), staff],
  );
  if (row.r_status !== "booked" || !row.r_id) return { status: row.r_status as "not_found" | "closed" | "full" | "duplicate" };
  return { status: "booked", id: row.r_id, code, token: token?.raw ?? null };
}

export async function getBooking(db: Db, id: string) {
  const [row] = await db.query<Booking>(
    `select id, created_at, slot_id, name, phone, email, needs, needs_other, registered_by, status, code
       from digital_bookings where id = $1`,
    [id],
  );
  return row ?? null;
}

export async function getBookingByToken(db: Db, rawToken: string) {
  const [row] = await db.query<Booking>(
    `select id, created_at, slot_id, name, phone, email, needs, needs_other, registered_by, status, code
       from digital_bookings where manage_token_hash = $1`,
    [hashToken(rawToken)],
  );
  return row ?? null;
}

export async function cancelBooking(db: Db, id: string) {
  const rows = await db.query(
    `update digital_bookings set status = 'cancelled', cancelled_at = now() where id = $1 and status = 'confirmed' returning id`,
    [id],
  );
  return rows.length === 1;
}

export async function moveBooking(db: Db, bookingId: string, slotId: string) {
  const [row] = await db.query<{ r: "moved" | "not_found" | "full" | "duplicate" }>(`select move_booking($1::uuid, $2::uuid) as r`, [
    bookingId,
    slotId,
  ]);
  return row.r;
}

/** Everyone booked into the given slots, with contact details (admin only). */
export const listBookingsForAdmin = (db: Db) =>
  db.query<Booking & { slot_date: string }>(
    `select b.id, b.created_at, b.slot_id, b.name, b.phone, b.email, b.needs, b.needs_other, b.registered_by,
            b.status, b.code, to_char(s.slot_date, 'YYYY-MM-DD') as slot_date
       from digital_bookings b join digital_slots s on s.id = b.slot_id
      where s.slot_date >= current_date - 30
      order by s.slot_date, s.start_time, b.created_at`,
  );

// ---------------------------------------------------------------- student volunteers

export type VolunteerStatus = "pending" | "confirmed" | "cancelled";
export type VolunteerResult = "confirmed" | "pending" | "not_found" | "closed" | "full" | "duplicate";

export async function volunteer(db: Db, slotId: string, studentId: string, { autoApprove, staff = false }: { autoApprove: boolean; staff?: boolean }) {
  const [row] = await db.query<{ r: VolunteerResult }>(`select volunteer_for_slot($1::uuid, $2::uuid, $3, $4) as r`, [
    slotId,
    studentId,
    autoApprove,
    staff,
  ]);
  return row.r;
}

/** A student cancels their own place, up to `cutoffHours` before the start. */
export async function cancelOwnVolunteering(db: Db, volunteerId: string, studentId: string, cutoffHours: number) {
  const [row] = await db.query<{ ok: boolean }>(`select cancel_volunteer($1::uuid, $2::uuid, $3::int) as ok`, [
    volunteerId,
    studentId,
    cutoffHours,
  ]);
  return row.ok;
}

export async function adminCancelVolunteer(db: Db, volunteerId: string) {
  const rows = await db.query(
    `update digital_volunteers set status = 'cancelled', cancelled_at = now() where id = $1 and status <> 'cancelled' returning id`,
    [volunteerId],
  );
  return rows.length === 1;
}

export async function approveVolunteer(db: Db, volunteerId: string) {
  const rows = await db.query(
    `update digital_volunteers set status = 'confirmed', approved_at = now() where id = $1 and status = 'pending' returning id`,
    [volunteerId],
  );
  return rows.length === 1;
}

export async function moveVolunteer(db: Db, volunteerId: string, slotId: string) {
  const [row] = await db.query<{ r: "moved" | "not_found" | "full" | "duplicate" }>(`select move_volunteer($1::uuid, $2::uuid) as r`, [
    volunteerId,
    slotId,
  ]);
  return row.r;
}

export type VolunteerRow = {
  id: string;
  slot_id: string;
  student_id: string;
  status: VolunteerStatus;
  student_name: string;
  student_email: string | null;
  student_phone: string | null;
};

export const listVolunteersForAdmin = (db: Db) =>
  db.query<VolunteerRow>(
    `select v.id, v.slot_id, v.student_id, v.status, st.name as student_name, st.email as student_email, st.phone as student_phone
       from digital_volunteers v
       join digital_slots s on s.id = v.slot_id
       join students st on st.id = v.student_id
      where s.slot_date >= current_date - 30 and v.status <> 'cancelled'
      order by s.slot_date, s.start_time, v.created_at`,
  );

export async function getVolunteer(db: Db, id: string) {
  const [row] = await db.query<VolunteerRow>(
    `select v.id, v.slot_id, v.student_id, v.status, st.name as student_name, st.email as student_email, st.phone as student_phone
       from digital_volunteers v join students st on st.id = v.student_id where v.id = $1`,
    [id],
  );
  return row ?? null;
}

/** First names of the residents booked into a slot (for the helper's "who and when" email). */
export const listBookedFirstNames = (db: Db, slotId: string) =>
  db.query<{ first_name: string }>(
    `select split_part(trim(name), ' ', 1) as first_name from digital_bookings
      where slot_id = $1 and status = 'confirmed' order by created_at`,
    [slotId],
  );

/** A student's own places (not cancelled), with the slot. */
export const listStudentSlots = (db: Db, studentId: string) =>
  db.query<Slot & { volunteer_id: string; volunteer_status: VolunteerStatus }>(
    `select o.*, v.id as volunteer_id, v.status as volunteer_status
       from digital_volunteers v join digital_slot_overview o on o.id = v.slot_id
      where v.student_id = $1 and v.status <> 'cancelled' and o.ends_at > now() - interval '7 days'
      order by o.slot_date, o.start_time`,
    [studentId],
  );

export type ResidentForVolunteer = {
  slot_id: string;
  first_name: string;
  needs: string[];
  needs_other: string | null;
  /** only within CONTACT_WINDOW_HOURS before the slot, for a confirmed volunteer who accepted the code of conduct */
  phone: string | null;
};

/**
 * The residents booked into THIS student's slots: first name and need only. The phone number is
 * added by the database itself, and only when the student is a confirmed volunteer of that slot,
 * has accepted the code of conduct, and the slot starts within CONTACT_WINDOW_HOURS (until it ends).
 */
export const listResidentsForVolunteer = (db: Db, studentId: string) =>
  db.query<ResidentForVolunteer>(
    `select b.slot_id, split_part(trim(b.name), ' ', 1) as first_name, b.needs, b.needs_other,
            case when v.status = 'confirmed' and st.conduct_accepted_at is not null
                      and now() >= o.starts_at - make_interval(hours => $2::int) and now() <= o.ends_at
                 then b.phone end as phone
       from digital_volunteers v
       join students st on st.id = v.student_id
       join digital_slot_overview o on o.id = v.slot_id
       join digital_bookings b on b.slot_id = v.slot_id and b.status = 'confirmed'
      where v.student_id = $1 and v.status <> 'cancelled' and o.status = 'scheduled'
      order by o.slot_date, o.start_time, b.created_at`,
    [studentId, CONTACT_WINDOW_HOURS],
  );

// ---------------------------------------------------------------- notifications

export type SlotPerson =
  | { kind: "resident"; id: string; name: string; phone: string; email: string | null }
  | { kind: "student"; id: string; name: string; phone: string | null; email: string | null };

/** Everyone with a place in a slot (active bookings and volunteers), for notices. */
export async function listSlotPeople(db: Db, slotId: string): Promise<SlotPerson[]> {
  const residents = await db.query<{ id: string; name: string; phone: string; email: string | null }>(
    `select id, name, phone, email from digital_bookings where slot_id = $1 and status = 'confirmed'`,
    [slotId],
  );
  const students = await db.query<{ id: string; name: string; phone: string | null; email: string | null }>(
    `select v.id, st.name, st.phone, st.email from digital_volunteers v join students st on st.id = v.student_id
      where v.slot_id = $1 and v.status <> 'cancelled'`,
    [slotId],
  );
  return [...residents.map((r) => ({ kind: "resident" as const, ...r })), ...students.map((s) => ({ kind: "student" as const, ...s }))];
}

/** Slots starting tomorrow (Israel date) with people who haven't had their reminder yet. */
export const listTomorrowSlotIds = (db: Db) =>
  db.query<{ id: string }>(
    `select id from digital_slots
      where status = 'scheduled' and slot_date = (now() at time zone 'Asia/Jerusalem')::date + 1`,
  );

export const listBookingsNeedingReminder = (db: Db, slotId: string) =>
  db.query<{ id: string; name: string; phone: string; email: string | null }>(
    `select id, name, phone, email from digital_bookings where slot_id = $1 and status = 'confirmed' and reminder_sent_at is null`,
    [slotId],
  );

export const listVolunteersNeedingReminder = (db: Db, slotId: string) =>
  db.query<{ id: string; name: string; phone: string | null; email: string | null }>(
    `select v.id, st.name, st.phone, st.email from digital_volunteers v join students st on st.id = v.student_id
      where v.slot_id = $1 and v.status = 'confirmed' and v.reminder_sent_at is null`,
    [slotId],
  );

export const markBookingReminded = (db: Db, id: string) =>
  db.query(`update digital_bookings set reminder_sent_at = now() where id = $1`, [id]);

export const markVolunteerReminded = (db: Db, id: string) =>
  db.query(`update digital_volunteers set reminder_sent_at = now() where id = $1`, [id]);
