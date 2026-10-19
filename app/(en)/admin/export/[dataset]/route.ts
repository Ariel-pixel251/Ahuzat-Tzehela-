import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db/client";
import { listAllDigitalRequests } from "@/lib/db/digital";
import { listRegistrations } from "@/lib/db/events";
import { listLeaders, listTasks } from "@/lib/db/leaders";
import * as misc from "@/lib/db/misc";
import { listPairs, listParticipants } from "@/lib/db/podcast";
import type { Db } from "@/lib/db/types";

type Export = (db: Db) => Promise<[string[], unknown[][]]>;

const exports: Record<string, Export> = {
  registrations: async (db) => [
    ["event_key", "event_en", "event_he", "date", "time", "kind", "portal", "name", "phone", "email", "people", "languages", "other_language", "preferred_language", "role", "notes", "status", "code", "registered_by", "created_at"],
    (await listRegistrations(db)).map((r) => [r.event_key, r.event_title_en, r.event_title_he, r.event_date, r.event_time, r.kind, r.portal, r.name, r.phone, r.email, r.attendees, r.languages, r.other_language, r.preferred_language, r.role, r.notes, r.status, r.code, r.registered_by, r.created_at]),
  ],
  digital: async (db) => [
    ["resident", "phone", "email", "needs", "needs_other", "days", "times", "language", "status", "volunteer", "volunteer_email", "approved_at", "code", "registered_by", "created_at"],
    (await listAllDigitalRequests(db)).map((r) => [r.resident_name, r.resident_phone, r.resident_email, r.needs, r.needs_other, r.preferred_days, r.preferred_parts, r.language, r.status, r.student_name, r.student_email, r.approved_at, r.code, r.registered_by, r.created_at]),
  ],
  podcast: async (db) => {
    const [people, pairs] = await Promise.all([listParticipants(db), listPairs(db)]);
    const partner = (id: string) => pairs.find((p) => p.members.some((m) => m.id === id))?.members.find((m) => m.id !== id)?.name ?? "";
    return [
      ["name", "portal", "email", "phone", "topics", "language", "availability", "status", "partner", "active", "code", "registered_by", "created_at"],
      people.map((p) => [p.name, p.portal, p.email, p.phone, p.topics, p.language, p.availability, p.status, partner(p.id), p.active, p.code, p.registered_by, p.created_at]),
    ];
  },
  lessons: async (db) => [
    ["name", "role", "portal", "phone", "email", "topics", "other_topic", "notes", "status", "code", "registered_by", "created_at"],
    (await misc.listLessonRequests(db)).map((r) => [r.name, r.role, r.portal, r.phone, r.email, r.topics, r.other_topic, r.notes, r.status, r.code, r.registered_by, r.created_at]),
  ],
  lectures: async (db) => [
    ["name", "phone", "email", "topic", "language", "preferred_date", "description", "status", "code", "registered_by", "created_at"],
    (await misc.listLectureProposals(db)).map((r) => [r.name, r.phone, r.email, r.topic, r.language, r.preferred_date, r.description, r.status, r.code, r.registered_by, r.created_at]),
  ],
  visits: async (db) => [
    ["name", "organization", "email", "phone", "preferred_dates", "group_size", "notes", "status", "created_at"],
    (await misc.listVisitRequests(db)).map((r) => [r.name, r.organization, r.email, r.phone, r.preferred_dates, r.group_size, r.notes, r.status, r.created_at]),
  ],
  callbacks: async (db) => [
    ["name", "phone", "handled", "registered_by", "created_at"],
    (await misc.listCallbacks(db)).map((r) => [r.name, r.phone, r.handled, r.registered_by, r.created_at]),
  ],
  messages: async (db) => [
    ["to_name", "to_phone", "channel", "body", "status", "created_at"],
    (await misc.listMessages(db)).map((m) => [m.to_name, m.to_phone, m.channel, m.body, m.status, m.created_at]),
  ],
  leaders: async (db) => [["name", "phone", "email", "project"], (await listLeaders(db)).map((l) => [l.name, l.phone, l.email, l.project])],
  tasks: async (db) => [
    ["title", "project", "leader", "status", "due_on"],
    (await listTasks(db)).map((t) => [t.title, t.project, t.leader_name, t.status, t.due_on]),
  ],
  announcements: async (db) => [
    ["text_en", "text_he", "active", "expires_on"],
    (await misc.listAnnouncements(db)).map((a) => [a.text_en, a.text_he, a.active, a.expires_on]),
  ],
  courses: async (db) => [
    ["title_en", "title_he", "description_en", "description_he", "active"],
    (await misc.listCourses(db, false)).map((c) => [c.title_en, c.title_he, c.description_en, c.description_he, c.active]),
  ],
  timetable: async (db) => [
    ["day", "start", "end", "title_en", "title_he", "location_en", "location_he"],
    (await misc.listSlots(db)).map((s) => [s.day, s.start_time, s.end_time, s.title_en, s.title_he, s.location_en, s.location_he]),
  ],
  topics: async (db) => [["name_en", "name_he", "active"], (await misc.listLessonTopics(db, false)).map((t) => [t.name_en, t.name_he, t.active])],
};

export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }) {
  if (!(await getAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const { dataset } = await params;
  const build = exports[dataset];
  if (!build) return new NextResponse("Not found", { status: 404 });
  const [head, rows] = await build(await getDb());
  return new NextResponse(toCsv(head, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dataset}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
