import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db/client";
import { listRegistrations } from "@/lib/db/events";
import { listLeaders, listTasks } from "@/lib/db/leaders";
import * as misc from "@/lib/db/misc";
import { listAllTimes, listPairs, listParticipants } from "@/lib/db/podcast";
import { formatPodcastTime } from "@/lib/i18n/format";
import { listBookingsForAdmin, listSlotsForAdmin, listVolunteersForAdmin } from "@/lib/db/slots";
import type { Db } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Export = (db: Db) => Promise<[string[], unknown[][]]>;

const exports: Record<string, Export> = {
  registrations: async (db) => [
    ["event_key", "event_en", "event_he", "date", "time", "kind", "portal", "name", "phone", "email", "people", "languages", "other_language", "preferred_language", "notes", "status", "code", "registered_by", "created_at"],
    (await listRegistrations(db)).map((r) => [r.event_key, r.event_title_en, r.event_title_he, r.event_date, r.event_time, r.kind, r.portal, r.name, r.phone, r.email, r.attendees, r.languages, r.other_language, r.preferred_language, r.notes, r.status, r.code, r.registered_by, r.created_at]),
  ],
  digital: async (db) => {
    const [slots, bookings, volunteers] = await Promise.all([listSlotsForAdmin(db), listBookingsForAdmin(db), listVolunteersForAdmin(db)]);
    const slotOf = (id: string) => slots.find((s) => s.id === id);
    return [
      ["slot_date", "start", "end", "place", "slot_status", "kind", "name", "phone", "email", "needs", "needs_other", "status", "code", "registered_by"],
      [
        ...bookings.map((b) => {
          const s = slotOf(b.slot_id);
          return [s?.slot_date, s?.start_time, s?.end_time, s?.place_he, s?.status, "resident", b.name, b.phone, b.email, b.needs, b.needs_other, b.status, b.code, b.registered_by];
        }),
        ...volunteers.map((v) => {
          const s = slotOf(v.slot_id);
          return [s?.slot_date, s?.start_time, s?.end_time, s?.place_he, s?.status, "student", v.student_name, v.student_phone, v.student_email, "", "", v.status, "", ""];
        }),
      ],
    ];
  },
  podcast: async (db) => {
    const [people, pairs, times] = await Promise.all([listParticipants(db), listPairs(db), listAllTimes(db)]);
    const timeOf = (id: string | null | undefined) => {
      const x = id ? times.find((t) => t.id === id) : null;
      return x ? formatPodcastTime(x, "en") : "";
    };
    const partner = (id: string) => pairs.find((p) => p.members.some((m) => m.id === id))?.members.find((m) => m.id !== id)?.name ?? "";
    return [
      ["name", "portal", "email", "phone", "topics", "language", "time", "availability", "status", "partner", "active", "code", "registered_by", "created_at"],
      people.map((p) => [p.name, p.portal, p.email, p.phone, p.topics, p.language, timeOf(p.time_id), p.availability, p.status, partner(p.id), p.active, p.code, p.registered_by, p.created_at]),
    ];
  },
  callbacks: async (db) => [
    ["name", "phone", "handled", "registered_by", "created_at"],
    (await misc.listCallbacks(db)).map((r) => [r.name, r.phone, r.handled, r.registered_by, r.created_at]),
  ],
  messages: async (db) => [
    ["to_name", "to_phone", "channel", "body", "status", "created_at"],
    (await misc.listMessages(db)).map((m) => [m.to_name, m.to_phone, m.channel, m.body, m.status, m.created_at]),
  ],
  reports: async (db) => [
    ["portal", "name", "contact", "message", "status", "created_at"],
    (await misc.listProblemReports(db)).map((r) => [r.portal, r.name, r.contact, r.message, r.status, r.created_at]),
  ],
  leaders: async (db) => [["name", "phone", "email", "project"], (await listLeaders(db)).map((l) => [l.name, l.phone, l.email, l.project])],
  tasks: async (db) => [
    ["title", "project", "leader", "status", "due_on"],
    (await listTasks(db)).map((t) => [t.title, t.project, t.leader_name, t.status, t.due_on]),
  ],
};

/** CSV downloads for admins only; every export is recorded in the audit log. */
export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { dataset } = await params;
  if (!Object.hasOwn(exports, dataset)) return new NextResponse("Not found", { status: 404 });
  const db = await getDb();
  const [head, rows] = await exports[dataset](db);
  await misc.audit(db, admin.email, "export", dataset, { rows: rows.length });
  return new NextResponse(toCsv(head, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dataset}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
