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
};

export type Participant = ParticipantInput & {
  id: string;
  created_at: Date;
  active: boolean;
  code: string;
  pair_id: string | null;
  status: PodcastStatus;
};

/** Public view for the "looking for a partner" list: first name only, no contact details. */
export type PublicParticipant = Pick<Participant, "id" | "portal" | "topics" | "language" | "availability" | "status"> & {
  first_name: string;
};

/** Returns null when this email or phone has already signed up. */
export async function joinPodcast(db: Db, input: ParticipantInput) {
  const code = newCode();
  const token = input.email ? newToken() : null;
  const rows = await db.query<{ id: string }>(
    `insert into podcast_participants
       (name, email, phone, portal, topics, language, availability, registered_by, code, manage_token_hash)
     values ($1, $2, $3, $4, text_array($5::text::jsonb), $6, $7, $8, $9, $10)
     on conflict do nothing returning id`,
    [
      input.name,
      input.email,
      input.phone,
      input.portal,
      JSON.stringify(input.topics),
      input.language,
      input.availability,
      input.registered_by,
      code,
      token?.hash ?? null,
    ],
  );
  return rows[0] ? { id: rows[0].id, code, token: token?.raw ?? null } : null;
}

export async function getParticipant(db: Db, id: string) {
  const [row] = await db.query<Participant>(`select * from podcast_people where id = $1`, [id]);
  return row ?? null;
}

export async function getParticipantByToken(db: Db, rawToken: string) {
  const [row] = await db.query<Participant>(`select * from podcast_people where manage_token_hash = $1`, [hashToken(rawToken)]);
  return row ?? null;
}

/** Active people not yet in a pair (status looking or requested). */
export const listLooking = (db: Db) =>
  db.query<PublicParticipant>(
    `select id, first_name, portal, topics, language, availability, status
       from podcast_people where active and pair_id is null order by created_at`,
  );

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

export type PairRequestView = { id: string; other_id: string; other_first_name: string; direction: "in" | "out" };

export const listPendingRequests = (db: Db, participantId: string) =>
  db.query<PairRequestView>(
    `select r.id,
            case when r.from_id = $1 then r.to_id else r.from_id end as other_id,
            split_part(trim(p.name), ' ', 1) as other_first_name,
            case when r.from_id = $1 then 'out' else 'in' end as direction
       from podcast_pair_requests r
       join podcast_participants p on p.id = case when r.from_id = $1 then r.to_id else r.from_id end
      where r.status = 'pending' and $1 in (r.from_id, r.to_id)
      order by r.created_at`,
    [participantId],
  );

export const listAllPendingRequests = (db: Db) =>
  db.query<{ id: string; from_id: string; from_name: string; to_id: string; to_name: string; created_at: Date }>(
    `select r.id, r.from_id, f.name as from_name, r.to_id, t.name as to_name, r.created_at
       from podcast_pair_requests r
       join podcast_participants f on f.id = r.from_id
       join podcast_participants t on t.id = r.to_id
      where r.status = 'pending' order by r.created_at`,
  );

export type RequestPairResult = "paired" | "requested" | "already_requested" | "unavailable";

export async function requestPair(db: Db, fromId: string, toId: string): Promise<RequestPairResult> {
  const [row] = await db.query<{ result: RequestPairResult }>(`select podcast_request_pair($1::uuid, $2::uuid) as result`, [
    fromId,
    toId,
  ]);
  return row.result;
}

export async function respondToRequest(db: Db, requestId: string, toId: string, accept: boolean) {
  const [row] = await db.query<{ result: "paired" | "declined" | "unavailable" }>(
    `select podcast_respond_request($1::uuid, $2::uuid, $3) as result`,
    [requestId, toId, accept],
  );
  return row.result;
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

/** Leave the project: out of any pair (partner goes back to looking), requests cancelled. */
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

/** A signed-in student's own podcast sign-up (matched by their email). */
export async function getParticipantByEmail(db: Db, email: string) {
  const [row] = await db.query<Participant>(`select * from podcast_people where lower(email) = lower($1) and active`, [email]);
  return row ?? null;
}
