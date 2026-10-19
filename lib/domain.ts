import "server-only";
import { DIGITAL_NEEDS, optionLabel } from "@/config/options";
import {
  eventForm,
  registrationOpen,
  todayInJerusalem,
  type CalendarData,
  type CalendarEvent,
} from "@/lib/calendar";
import * as digital from "@/lib/db/digital";
import * as events from "@/lib/db/events";
import * as misc from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import { getStudent } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import { formatEventWhen } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n";
import { notify } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
import { formatPhone } from "@/lib/phone";

// Business logic shared by the portals and the admin "register on behalf" screen.

const portalPath = (portal: "student" | "resident") => (portal === "student" ? "students" : "residents");
const localeOf = (portal: "student" | "resident"): Locale => (portal === "student" ? "en" : "he");
const firstName = (name: string) => name.trim().split(/\s+/)[0];

// ---------------------------------------------------------------- events

export type EventPersonInput = Pick<
  events.RegistrationInput,
  | "portal"
  | "name"
  | "phone"
  | "email"
  | "attendees"
  | "notes"
  | "languages"
  | "other_language"
  | "preferred_language"
  | "role"
  | "registered_by"
>;

export type RegisterEventResult =
  | { status: "confirmed" | "waitlist"; code: string }
  | { status: "duplicate" | "closed" | "not-registrable" };

export async function registerEvent(
  db: Db,
  event: CalendarEvent,
  person: EventPersonInput,
  baseUrl: string,
  { ignoreDeadline = false } = {},
): Promise<RegisterEventResult> {
  const form = eventForm(event);
  if (!form || form === "podcast" || form === "digital-support") return { status: "not-registrable" };
  if (!ignoreDeadline && !registrationOpen(event)) return { status: "closed" };

  const res = await events.registerForEvent(
    db,
    {
      ...person,
      event_key: event.key,
      event_title_en: event.title.en,
      event_title_he: event.title.he,
      event_date: event.date,
      event_time: event.startTime ?? null,
      kind: form,
    },
    event.capacity ?? null,
  );
  if (res.status === "duplicate") return res;

  const locale = localeOf(person.portal);
  await notify(
    db,
    person,
    templates.eventConfirmation(locale, {
      name: firstName(person.name),
      title: event.title[locale],
      when: formatEventWhen(event, locale),
      waitlist: res.status === "waitlist",
      code: res.code,
      manageUrl: res.token ? `${baseUrl}/${portalPath(person.portal)}/manage/event?token=${res.token}` : null,
    }),
  );
  return { status: res.status, code: res.code };
}

/** Cancels a registration and tells anyone promoted from the waiting list. */
export async function cancelEventRegistration(db: Db, registration: events.Registration, calendar: CalendarData) {
  const event = calendar.all.find((e) => e.key === registration.event_key);
  const promoted = await events.cancelRegistration(db, registration.id, event?.capacity ?? null);
  for (const p of promoted) {
    const locale = localeOf(p.portal);
    await notify(
      db,
      p,
      templates.promotedFromWaitlist(locale, {
        name: firstName(p.name),
        title: locale === "he" ? p.event_title_he : p.event_title_en,
        when: event ? formatEventWhen(event, locale) : p.event_date,
      }),
    );
  }
}

/** Sends the bilingual "cancelled" notice to everyone registered for an event. */
export async function notifyEventCancelled(db: Db, eventKey: string) {
  const regs = await events.listRegistrationsForEvent(db, eventKey);
  for (const r of regs) {
    const when = (l: Locale) => formatEventWhen({ date: r.event_date, startTime: r.event_time ?? undefined }, l);
    await notify(db, r, templates.eventCancelled({
      name: firstName(r.name),
      titleEn: r.event_title_en,
      titleHe: r.event_title_he,
      whenEn: when("en"),
      whenHe: when("he"),
    }));
  }
  await events.markCancelNoticeSent(db, eventKey);
  return regs.length;
}

/** Day-before reminders, using the event's CURRENT time from the calendar. */
export async function sendReminders(db: Db, calendar: CalendarData, now = new Date()) {
  const tomorrow = todayInJerusalem(new Date(now.getTime() + 86_400_000));
  let sent = 0;
  for (const event of calendar.upcoming.filter((e) => e.date === tomorrow)) {
    const occurrence = `${event.date} ${event.startTime ?? ""}`.trim();
    for (const r of await events.listNeedingReminder(db, event.key, occurrence)) {
      const locale = localeOf(r.portal);
      await notify(db, r, templates.eventReminder(locale, {
        name: firstName(r.name),
        title: event.title[locale],
        when: formatEventWhen(event, locale),
      }));
      await events.markReminderSent(db, r.id, occurrence);
      sent++;
    }
  }
  return sent;
}

// ---------------------------------------------------------------- digital support

export async function createDigital(db: Db, input: digital.DigitalInput, baseUrl: string) {
  const res = await digital.createDigitalRequest(db, input);
  await notify(
    db,
    { name: input.resident_name, phone: input.resident_phone, email: input.resident_email, portal: "resident" },
    templates.residentReceived({
      name: firstName(input.resident_name),
      what: "עזרה עם הטלפון או המחשב",
      code: res.code,
      manageUrl: res.token ? `${baseUrl}/residents/manage/help?token=${res.token}` : null,
    }),
  );
  return res;
}

export async function requireMatchApproval(db: Db) {
  return Boolean(await misc.getSetting(db, "require_match_approval", false));
}

/** Student takes a request. Returns "taken", "pending-approval" or "unavailable". */
export async function claimDigital(db: Db, requestId: string, studentId: string, baseUrl: string) {
  const autoApprove = !(await requireMatchApproval(db));
  const ok = await digital.claimDigitalRequest(db, requestId, studentId, autoApprove);
  if (!ok) return "unavailable" as const;
  if (!autoApprove) return "pending-approval" as const;
  await notifyDigitalMatch(db, requestId, baseUrl);
  return "taken" as const;
}

export async function approveDigital(db: Db, requestId: string, baseUrl: string) {
  if (await digital.approveDigitalMatch(db, requestId)) await notifyDigitalMatch(db, requestId, baseUrl);
}

export async function adminAssignDigital(db: Db, requestId: string, studentId: string | null, baseUrl: string) {
  const ok = await digital.adminAssignDigitalRequest(db, requestId, studentId);
  if (ok && studentId) await notifyDigitalMatch(db, requestId, baseUrl);
  return ok;
}

async function notifyDigitalMatch(db: Db, requestId: string, baseUrl: string) {
  const r = await digital.getDigitalRequest(db, requestId);
  const s = r?.student_id ? await getStudent(db, r.student_id) : null;
  if (!r || !s) return;
  await notify(
    db,
    { name: r.resident_name, phone: r.resident_phone, email: r.resident_email, portal: "resident" },
    templates.digitalAssignedResident({ name: firstName(r.resident_name), volunteer: firstName(s.name) }),
  );
  await notify(
    db,
    { name: s.name, email: s.email, portal: "student" },
    templates.digitalAssignedStudent({
      name: firstName(s.name),
      resident: firstName(r.resident_name),
      needs: r.needs.map((n) => optionLabel(DIGITAL_NEEDS, n, "en")).join(", "),
      url: `${baseUrl}/students/digital/mine`,
    }),
  );
}

// ---------------------------------------------------------------- podcast

export async function joinPodcast(db: Db, input: podcast.ParticipantInput, baseUrl: string) {
  const res = await podcast.joinPodcast(db, input);
  if (!res) return null;
  const locale = localeOf(input.portal);
  await notify(
    db,
    input,
    templates.podcastJoined(locale, {
      name: firstName(input.name),
      code: res.code,
      // students pair themselves on their podcast page; residents are paired by the team
      manageUrl: input.portal === "student" && res.token ? `${baseUrl}/students/podcast/manage?token=${res.token}` : null,
    }),
  );
  return res;
}

export async function requestPodcastPair(db: Db, fromId: string, toId: string) {
  const result = await podcast.requestPair(db, fromId, toId);
  if (result === "requested") {
    const [from, to] = await Promise.all([podcast.getParticipant(db, fromId), podcast.getParticipant(db, toId)]);
    if (from && to) {
      await notify(db, to, templates.podcastPairRequest(localeOf(to.portal), { name: firstName(to.name), from: firstName(from.name) }));
    }
  }
  if (result === "paired") await notifyPodcastPaired(db, fromId, toId);
  return result;
}

export async function respondPodcastRequest(db: Db, requestId: string, toId: string, accept: boolean) {
  const pending = await podcast.listPendingRequests(db, toId);
  const result = await podcast.respondToRequest(db, requestId, toId, accept);
  const req = pending.find((p) => p.id === requestId);
  if (result === "paired" && req) await notifyPodcastPaired(db, req.other_id, toId);
  return result;
}

export async function adminPairPodcast(db: Db, a: string, b: string) {
  const pairId = await podcast.makePair(db, a, b, "admin");
  if (pairId) await notifyPodcastPaired(db, a, b);
  return pairId;
}

async function notifyPodcastPaired(db: Db, aId: string, bId: string) {
  const [a, b] = await Promise.all([podcast.getParticipant(db, aId), podcast.getParticipant(db, bId)]);
  if (!a || !b) return;
  for (const [me, other] of [
    [a, b],
    [b, a],
  ] as const) {
    const contact = [other.email, formatPhone(other.phone)].filter(Boolean).join(", ");
    await notify(
      db,
      me,
      templates.podcastPaired(localeOf(me.portal), { name: firstName(me.name), partner: firstName(other.name), partnerContact: contact }),
    );
  }
}

// ---------------------------------------------------------------- lessons, lectures, callbacks

export async function createLesson(db: Db, input: misc.LessonInput) {
  const res = await misc.createLessonRequest(db, input);
  if (input.portal === "resident") {
    await notify(db, input, templates.residentReceived({ name: firstName(input.name), what: "שיעור פרטי", code: res.code }));
  }
  return res;
}

export async function matchLessons(db: Db, learnerId: string, teacherId: string, topic: string | null) {
  const ok = await misc.matchLesson(db, learnerId, teacherId, topic);
  if (!ok) return false;
  const all = await misc.listLessonRequests(db);
  const learner = all.find((r) => r.id === learnerId);
  const teacher = all.find((r) => r.id === teacherId);
  if (learner && teacher) {
    const t = topic ?? "";
    await notify(db, learner, templates.lessonMatched(localeOf(learner.portal), {
      name: firstName(learner.name), other: firstName(teacher.name), topic: t, contact: "",
    }));
    await notify(db, teacher, templates.lessonMatched(localeOf(teacher.portal), {
      name: firstName(teacher.name),
      other: firstName(learner.name),
      topic: t,
      contact: [learner.email, formatPhone(learner.phone)].filter(Boolean).join(", "),
    }));
  }
  return true;
}

export async function createLecture(db: Db, input: misc.LectureInput) {
  const res = await misc.createLectureProposal(db, input);
  await notify(
    db,
    { name: input.name, phone: input.phone, email: input.email, portal: "resident" },
    templates.residentReceived({ name: firstName(input.name), what: "הצעת הרצאה", code: res.code }),
  );
  return res;
}
