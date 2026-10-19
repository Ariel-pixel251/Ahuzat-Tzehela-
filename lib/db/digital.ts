import { hashToken, newCode, newToken } from "../tokens";
import type { Db } from "./types";

export type DigitalStatus = "open" | "assigned" | "done" | "cancelled";

export type DigitalInput = {
  resident_name: string;
  resident_phone: string;
  resident_email: string | null;
  needs: string[];
  needs_other: string | null;
  preferred_days: string[];
  /** chosen hours, e.g. ["10:00","11:00"] (older requests: "morning"/"afternoon") */
  preferred_parts: string[];
  language: string;
  registered_by: string | null;
};

export type DigitalRequest = DigitalInput & {
  id: string;
  created_at: Date;
  status: DigitalStatus;
  student_id: string | null;
  assigned_at: Date | null;
  approved_at: Date | null;
  code: string;
};

/** What students may see on the public board: first name and the need, never contact details. */
export type PublicDigitalRequest = Pick<
  DigitalRequest,
  "id" | "created_at" | "needs" | "needs_other" | "preferred_days" | "preferred_parts" | "language"
> & { first_name: string };

const COLUMNS = `id, created_at, resident_name, resident_phone, resident_email, needs, needs_other, preferred_days,
  preferred_parts, language, registered_by, status, student_id, assigned_at, approved_at, code`;

export async function createDigitalRequest(db: Db, input: DigitalInput) {
  const code = newCode();
  const token = input.resident_email ? newToken() : null;
  const [row] = await db.query<{ id: string }>(
    `insert into digital_requests
       (resident_name, resident_phone, resident_email, needs, needs_other, preferred_days, preferred_parts,
        language, registered_by, code, manage_token_hash)
     values ($1, $2, $3, text_array($4::text::jsonb), $5, text_array($6::text::jsonb), text_array($7::text::jsonb), $8, $9, $10, $11)
     returning id`,
    [
      input.resident_name,
      input.resident_phone,
      input.resident_email,
      JSON.stringify(input.needs),
      input.needs_other,
      JSON.stringify(input.preferred_days),
      JSON.stringify(input.preferred_parts),
      input.language,
      input.registered_by,
      code,
      token?.hash ?? null,
    ],
  );
  return { id: row.id, code, token: token?.raw ?? null };
}

export async function getDigitalRequest(db: Db, id: string) {
  const [row] = await db.query<DigitalRequest>(`select ${COLUMNS} from digital_requests where id = $1`, [id]);
  return row ?? null;
}

export async function getDigitalRequestByToken(db: Db, rawToken: string) {
  const [row] = await db.query<DigitalRequest>(`select ${COLUMNS} from digital_requests where manage_token_hash = $1`, [
    hashToken(rawToken),
  ]);
  return row ?? null;
}

export async function cancelDigitalRequestByToken(db: Db, rawToken: string) {
  const rows = await db.query(
    `update digital_requests set status = 'cancelled', updated_at = now()
      where manage_token_hash = $1 and status in ('open', 'assigned') returning id`,
    [hashToken(rawToken)],
  );
  return rows.length === 1;
}

export const listOpenDigitalRequests = (db: Db) =>
  db.query<PublicDigitalRequest>(
    `select id, created_at, split_part(trim(resident_name), ' ', 1) as first_name,
            needs, needs_other, preferred_days, preferred_parts, language
       from digital_requests where status = 'open' order by created_at`,
  );

/** Requests one student took. Contact details are only shown by the page once approved. */
export const listStudentDigitalRequests = (db: Db, studentId: string) =>
  db.query<DigitalRequest>(
    `select ${COLUMNS} from digital_requests
      where student_id = $1 and status in ('assigned', 'done') order by status, assigned_at desc`,
    [studentId],
  );

export async function claimDigitalRequest(db: Db, requestId: string, studentId: string, autoApprove: boolean) {
  const [row] = await db.query<{ ok: boolean }>(`select claim_digital_request($1::uuid, $2::uuid, $3) as ok`, [
    requestId,
    studentId,
    autoApprove,
  ]);
  return row.ok;
}

async function rpc(db: Db, fn: string, requestId: string, studentId: string | null) {
  const [row] = await db.query<{ ok: boolean }>(`select ${fn}($1::uuid, $2::uuid) as ok`, [requestId, studentId]);
  return row.ok;
}

export const releaseDigitalRequest = (db: Db, requestId: string, studentId: string) =>
  rpc(db, "release_digital_request", requestId, studentId);
export const completeDigitalRequest = (db: Db, requestId: string, studentId: string) =>
  rpc(db, "complete_digital_request", requestId, studentId);
export const adminAssignDigitalRequest = (db: Db, requestId: string, studentId: string | null) =>
  rpc(db, "admin_assign_digital_request", requestId, studentId);

export async function approveDigitalMatch(db: Db, requestId: string) {
  const rows = await db.query(
    `update digital_requests set approved_at = now(), updated_at = now()
      where id = $1 and status = 'assigned' and approved_at is null returning id`,
    [requestId],
  );
  return rows.length === 1;
}

export async function adminSetDigitalStatus(db: Db, requestId: string, status: "done" | "cancelled") {
  const rows = await db.query(`update digital_requests set status = $2, updated_at = now() where id = $1 returning id`, [
    requestId,
    status,
  ]);
  return rows.length === 1;
}

export type AdminDigitalRow = DigitalRequest & {
  student_name: string | null;
  student_email: string | null;
  student_phone: string | null;
};

export const listAllDigitalRequests = (db: Db) =>
  db.query<AdminDigitalRow>(
    `select ${COLUMNS.split(",").map((c) => `r.${c.trim()}`).join(", ")},
            s.name as student_name, s.email as student_email, s.phone as student_phone
       from digital_requests r left join students s on s.id = r.student_id
      order by r.created_at desc`,
  );
