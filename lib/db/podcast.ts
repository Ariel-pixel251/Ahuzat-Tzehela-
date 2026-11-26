import { hashToken, newCode, newToken } from "../tokens";
import type { Portal } from "./events";
import type { Db } from "./types";

export type PodcastStatus = "looking" | "requested" | "paired";

export type ParticipantInput = {
  name: string;
  email: string | null;
  phone: string | null;
  portal: Portal;
  topics: string[];
  language: string;
  availability: string | null;
  registered_by: string | null;
  /** one of the team's podcast times (null only for older sign-ups and some made by staff) */
  time_id?: string | null;
};

export type Participant = ParticipantInput & {
  id: string;
  created_at: Date;
  active: boolean;
  code: string;
  pair_id: string | null;
  status: PodcastStatus;
};

export type JoinPodcastResult =
  | { status: "joined"; id: string; code: string; token: string }
  | { status: "duplicate" | "full" | "closed" | "not_found" };

/**
 * Sign up, optionally at one of the team's podcast times (`time_id`). The database checks the time
 * atomically: "full" once its places for this portal are taken, "closed" when the team closed it or
 * it has started. "duplicate": this email or phone is already taking part. Everyone gets a cancel
 * token (only its hash is stored): emailed to students, kept on the confirmation screen for residents.
 * `staff`: the team adding someone may use a closed or full time.
 */
export async function joinPodcastAt(db: Db, input: ParticipantInput, { staff = false } = {}): Promise<JoinPodcastResult> {
  const code = newCode();
  const token = newToken();
  const person = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    portal: input.portal,
    topics: input.topics,
    language: input.language,
    availability: input.availability,
    registered_by: input.registered_by,
    code,
    manage_token_hash: token.hash,
  };
  const [row] = await db.query<{ r_id: string | null; r_status: "joined" | "duplicate" | "full" | "closed" | "not_found" }>(
    `select r_id, r_status from podcast_join($1::text::jsonb, $2::uuid, $3)`,
    [JSON.stringify(person), input.time_id ?? null, staff],
  );
  if (row.r_status !== "joined" || !row.r_id) return { status: row.r_status === "joined" ? "duplicate" : row.r_status };
  return { status: "joined", id: row.r_id, code, token: token.raw };
}

/** Returns null when this email or phone has already signed up (or the time can't be used). */
export async function joinPodcast(db: Db, input: ParticipantInput) {
  const res = await joinPodcastAt(db, input, { staff: true });
  return res.status === "joined" ? { id: res.id, code: res.code, token: res.token } : null;
}

// ---------------------------------------------------------------- podcast times (set by the team)

export type PodcastTime = {
  id: string;
  time_date: string;
  start_time: string;
  end_time: string;
  place_he: string;
  place_en: string | null;
  resident_places: number;
  student_places: number;
  open: boolean;
  status: "scheduled" | "cancelled";
  starts_at: Date;
  /** residents and students (still taking part) who chose this time */
  residents: number;
  students: number;
};

export type PodcastTimeInput = Pick<PodcastTime, "time_date" | "start_time" | "end_time" | "place_he" | "place_en" | "resident_places" | "student_places">;

/** Times that haven't started yet (all of them, open, closed or cancelled), soonest first. */
export const listUpcomingTimes = (db: Db) =>
  db.query<PodcastTime>(`select * from podcast_time_overview where starts_at > now() order by starts_at`);

/** Times people from this portal can choose right now: scheduled, open, not started, places left. */
export async function listOpenTimes(db: Db, portal: Portal) {
  return (await listUpcomingTimes(db)).filter((t) => t.status === "scheduled" && t.open && placesLeft(t, portal) > 0);
}

export const listAllTimes = (db: Db) => db.query<PodcastTime>(`select * from podcast_time_overview order by starts_at desc`);

export async function getPodcastTime(db: Db, id: string) {
  const [row] = await db.query<PodcastTime>(`select * from podcast_time_overview where id = $1`, [id]);
  return row ?? null;
}

/** Places left for this portal at a time. */
export const placesLeft = (t: Pick<PodcastTime, "resident_places" | "student_places" | "residents" | "students">, portal: Portal) =>
  Math.max(0, portal === "resident" ? t.resident_places - t.residents : t.student_places - t.students);

/** Creates one time, or one every week from the date until `repeatUntil`. Returns how many. */
export async function createPodcastTimes(db: Db, input: PodcastTimeInput, repeatUntil: string | null) {
  const rows = await db.query<{ id: string }>(
    `insert into podcast_times (time_date, start_time, end_time, place_he, place_en, resident_places, student_places, pairs)
     select d::date, $3, $4, $5, $6, $7::int, $8::int, greatest($7::int, $8::int)
       from generate_series($1::date, greatest($1::date, coalesce($2::date, $1::date)), interval '7 days') d
     returning id`,
    [input.time_date, repeatUntil, input.start_time, input.end_time, input.place_he, input.place_en, input.resident_places, input.student_places],
  );
  return rows.length;
}

export const setPodcastTimeOpen = (db: Db, id: string, open: boolean) =>
  db.query(`update podcast_times set open = $2 where id = $1 and status = 'scheduled'`, [id, open]);

/**
 * Cancels a time. Returns the people who had chosen it (to tell them), or null if it was already
 * cancelled. They leave the podcast (and any pair), so they can sign up again for another time.
 */
export async function cancelPodcastTime(db: Db, id: string) {
  const rows = await db.query(
    `update podcast_times set status = 'cancelled', cancelled_at = now() where id = $1 and status = 'scheduled' returning id`,
    [id],
  );
  if (!rows.length) return null;
  const people = await db.query<Participant>(`select * from podcast_people where time_id = $1 and active`, [id]);
  for (const p of people) await withdraw(db, p.id);
  return people;
}

/** The people (still taking part) who chose a time, unpaired first. */
export const listTimePeople = (db: Db, timeId: string) =>
  db.query<Participant>(`select * from podcast_people where time_id = $1 and active order by pair_id nulls first, created_at`, [timeId]);

/** When and where a pair meets, if set. */
export async function getPairMeeting(db: Db, pairId: string): Promise<Meeting | null> {
  const [row] = await db.query<{ date: string | null; time: string | null; place: string | null }>(
    `select to_char(meeting_date, 'YYYY-MM-DD') as date, meeting_time as time, meeting_place as place from podcast_pairs where id = $1`,
    [pairId],
  );
  return row?.date ? { date: row.date, time: row.time, place: row.place } : null;
}

export async function getParticipant(db: Db, id: string) {
  const [row] = await db.query<Participant>(`select * from podcast_people where id = $1`, [id]);
  return row ?? null;
}

export async function getParticipantByToken(db: Db, rawToken: string) {
  const [row] = await db.query<Participant>(`select * from podcast_people where manage_token_hash = $1`, [hashToken(rawToken)]);
  return row ?? null;
}

export const listParticipants = (db: Db) => db.query<Participant>(`select * from podcast_people order by created_at`);

/** The other member of someone's pair, with contact details (only for their partner and admins). */
export async function getPartner(db: Db, participantId: string) {
  const [row] = await db.query<Participant>(
    `select * from podcast_people
      where pair_id = (select pair_id from podcast_pair_members where participant_id = $1) and id <> $1`,
    [participantId],
  );
  return row ?? null;
}

/** Pairs two people. Returns the pair id, or null if either is unavailable. */
export async function makePair(db: Db, a: string, b: string, createdBy: "admin" | "participants" = "admin") {
  const [row] = await db.query<{ pair_id: string | null }>(`select podcast_make_pair($1::uuid, $2::uuid, $3) as pair_id`, [
    a,
    b,
    createdBy,
  ]);
  return row.pair_id;
}

export const listPairs = (db: Db) =>
  db.query<{
    pair_id: string;
    created_at: Date;
    created_by: string;
    meeting_date: string | null;
    meeting_time: string | null;
    meeting_place: string | null;
    members: Participant[];
  }>(
    `select pp.id as pair_id, pp.created_at, pp.created_by, to_char(pp.meeting_date, 'YYYY-MM-DD') as meeting_date,
            pp.meeting_time, pp.meeting_place,
            (select json_agg(json_build_object('id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone,
                    'portal', p.portal, 'language', p.language) order by p.portal desc)
               from podcast_pair_members m join podcast_participants p on p.id = m.participant_id
              where m.pair_id = pp.id) as members
       from podcast_pairs pp order by pp.created_at desc`,
  );

export type Meeting = { date: string; time: string | null; place: string | null };

/** When and where a pair first meets (set by an admin). */
export const setPairMeeting = (db: Db, pairId: string, m: Meeting) =>
  db.query(`update podcast_pairs set meeting_date = $2, meeting_time = $3, meeting_place = $4 where id = $1`, [
    pairId,
    m.date,
    m.time,
    m.place,
  ]);

export const unpair = (db: Db, pairId: string) => db.query(`delete from podcast_pairs where id = $1`, [pairId]);

/** Leave the podcast: out of any pair (the partner stays signed up for the time), requests cancelled. */
export async function withdraw(db: Db, participantId: string) {
  await db.query(
    `delete from podcast_pairs where id = (select pair_id from podcast_pair_members where participant_id = $1)`,
    [participantId],
  );
  await db.query(`update podcast_participants set active = false, withdrawn_at = now() where id = $1`, [participantId]);
  await db.query(`update podcast_pair_requests set status = 'cancelled' where status = 'pending' and $1 in (from_id, to_id)`, [
    participantId,
  ]);
}

/** The active sign-up with this phone or email, if any (to recognise a repeat sign-up). */
export async function getActiveParticipant(db: Db, by: { phone: string | null; email: string | null }) {
  const [row] = await db.query<Participant>(
    `select * from podcast_people where active and (phone = $1 or lower(email) = lower($2)) limit 1`,
    [by.phone, by.email],
  );
  return row ?? null;
}
