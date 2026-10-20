import "server-only";
import { eventForm, registrationOpen, todayInJerusalem, type CalendarData, type CalendarEvent } from "@/lib/calendar";
import * as events from "@/lib/db/events";
import * as misc from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import { getStudent } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import { formatDateTime, formatEventWhen, formatSlot } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n";
import { notify, type Recipient } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
import { formatPhone } from "@/lib/phone";

// Business logic shared by the portals and the admin screens.

const portalPath = (portal: "student" | "resident") => (portal === "student" ? "students" : "residents");
const localeOf = (portal: "student" | "resident"): Locale => (portal === "student" ? "en" : "he");
const firstName = (name: string) => name.trim().split(/\s+/)[0];

// ---------------------------------------------------------------- events

export type EventPersonInput = Pick<
  events.RegistrationInput,
  "portal" | "name" | "phone" | "email" | "attendees" | "notes" | "languages" | "other_language" | "preferred_language" | "registered_by"
>;

export type RegisterEventResult =
  | { status: "confirmed" | "waitlist"; code: string }
  | { status: "duplicate" | "closed" | "not-registrable" | "blocked" };

export async function registerEvent(
  db: Db,
  event: CalendarEvent,
  person: EventPersonInput,
  baseUrl: string,
  { ignoreDeadline = false } = {},
): Promise<RegisterEventResult> {
  const form = eventForm(event);
  if (!form || form === "podcast") return { status: "not-registrable" };
  if (!ignoreDeadline && !registrationOpen(event)) return { status: "closed" };
  if (await misc.isBlocked(db, person.phone, person.email)) return { status: "blocked" };

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
  // without the event (calendar unreachable or event changed), the daily job promotes people instead
  const promoted = await events.cancelRegistration(db, registration.id, event?.capacity ?? null);
  await notifyPromoted(db, promoted, event);
}

async function notifyPromoted(db: Db, promoted: events.Registration[], event: CalendarEvent | undefined) {
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

/** Daily: move people up from waiting lists of upcoming events that have room (e.g. capacity raised). */
export async function promoteWaitlists(db: Db, calendar: CalendarData) {
  if (calendar.source !== "calendar") return 0;
  let count = 0;
  for (const event of calendar.upcoming) {
    if (event.capacity === undefined) continue;
    const promoted = await events.promoteWaitlist(db, event.key, event.capacity);
    await notifyPromoted(db, promoted, event);
    count += promoted.length;
  }
  return count;
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

// ---------------------------------------------------------------- digital support slots

const resident = (p: { name: string; phone: string; email: string | null }): Recipient => ({ ...p, portal: "resident" });
const student = (p: { name: string; phone: string | null; email: string | null }): Recipient => ({ ...p, portal: "student" });

export type BookDigitalResult = Awaited<ReturnType<typeof slots.bookSlot>> | { status: "blocked" };

/** A resident books a place in a slot (atomically), then gets a confirmation with the code. */
export async function bookDigital(db: Db, slotId: string, input: slots.BookingInput, baseUrl: string, { staff = false } = {}): Promise<BookDigitalResult> {
  if (await misc.isBlocked(db, input.phone, input.email)) return { status: "blocked" };
  const res = await slots.bookSlot(db, slotId, input, { staff });
  if (res.status !== "booked") return res;
  const slot = await slots.getSlot(db, slotId);
  if (slot) {
    await notify(
      db,
      resident(input),
      templates.slotBooked({
        name: firstName(input.name),
        slot: formatSlot(slot, "he"),
        code: res.code,
        manageUrl: res.token ? `${baseUrl}/residents/manage/help?token=${res.token}` : null,
      }),
    );
  }
  return res;
}

export async function helperApprovalRequired(db: Db) {
  return Boolean(await misc.getSetting(db, "require_helper_approval", false));
}

export async function studentCancelCutoffHours(db: Db) {
  const n = Number(await misc.getSetting(db, "student_cancel_cutoff_hours", 24));
  return Number.isFinite(n) && n >= 0 ? n : 24;
}

/** A student volunteers for a slot (atomically, within the number of helpers needed). */
export async function volunteerForSlot(db: Db, slotId: string, s: { id: string; name: string; email: string | null; phone: string | null }, baseUrl: string) {
  if (await misc.isBlocked(db, s.phone, s.email)) return "blocked" as const;
  const result = await slots.volunteer(db, slotId, s.id, { autoApprove: !(await helperApprovalRequired(db)) });
  if (result === "confirmed" || result === "pending") {
    const slot = await slots.getSlot(db, slotId);
    if (slot) {
      await notify(db, student(s), templates.slotVolunteered({
        name: firstName(s.name),
        slot: formatSlot(slot, "en"),
        pending: result === "pending",
        url: `${baseUrl}/students/mine`,
      }));
    }
  }
  return result;
}

/**
 * Admin: put a student into a slot (confirmed at once; the student needn't have signed up).
 * With `notify`, the student is told when and where, and who is booked so far.
 */
export async function adminAddVolunteer(db: Db, slotId: string, studentId: string, { notify: send = false, baseUrl = "" } = {}) {
  const result = await slots.volunteer(db, slotId, studentId, { autoApprove: true, staff: true });
  if (result === "confirmed" && send) {
    const [slot, s, names] = await Promise.all([slots.getSlot(db, slotId), getStudent(db, studentId), slots.listBookedFirstNames(db, slotId)]);
    if (slot && s) {
      await notify(db, student(s), templates.helperAssigned({
        name: firstName(s.name),
        slot: formatSlot(slot, "en"),
        residents: names.map((n) => n.first_name),
        url: `${baseUrl}/students/mine`,
      }));
    }
  }
  return result;
}

export async function approveVolunteer(db: Db, volunteerId: string, baseUrl: string) {
  if (!(await slots.approveVolunteer(db, volunteerId))) return false;
  const v = await slots.getVolunteer(db, volunteerId);
  const slot = v ? await slots.getSlot(db, v.slot_id) : null;
  if (v && slot) {
    await notify(db, student({ name: v.student_name, phone: v.student_phone, email: v.student_email }), templates.slotVolunteered({
      name: firstName(v.student_name),
      slot: formatSlot(slot, "en"),
      pending: false,
      url: `${baseUrl}/students/mine`,
    }));
  }
  return true;
}

/** Tells everyone in a slot that it changed (time, date or place) or was cancelled. */
async function noticeToSlotPeople(db: Db, people: slots.SlotPerson[], message: (locale: Locale, name: string) => ReturnType<typeof templates.slotCancelled>) {
  for (const p of people) {
    const locale: Locale = p.kind === "resident" ? "he" : "en";
    const to = p.kind === "resident" ? resident(p) : student(p);
    await notify(db, to, message(locale, firstName(p.name)));
  }
  return people.length;
}

/** Admin: cancels a slot (bookings and volunteers too) and tells everyone affected. */
export async function cancelSlotAndNotify(db: Db, slotId: string) {
  const slot = await slots.getSlot(db, slotId);
  if (!slot || slot.status !== "scheduled") return null;
  const people = await slots.listSlotPeople(db, slotId);
  if (!(await slots.cancelSlot(db, slotId))) return null;
  return noticeToSlotPeople(db, people, (locale, name) => templates.slotCancelled(locale, { name, slot: formatSlot(slot, locale) }));
}

/** Admin: edits a slot; if the date, time or place moved, tells everyone in it. */
export async function updateSlotAndNotify(db: Db, slotId: string, input: slots.SlotInput) {
  const before = await slots.updateSlot(db, slotId, input);
  if (!before) return null;
  const moved =
    before.slot_date !== input.slot_date ||
    before.start_time !== input.start_time ||
    before.end_time !== input.end_time ||
    before.place_he !== input.place_he ||
    (before.place_en ?? null) !== input.place_en;
  if (!moved) return 0;
  const people = await slots.listSlotPeople(db, slotId);
  return noticeToSlotPeople(db, people, (locale, name) =>
    templates.slotChanged(locale, { name, before: formatSlot(before, locale), after: formatSlot(input, locale) }),
  );
}

/** Admin: blocks a date (holiday) and cancels any slots on it, telling the people in them. */
export async function blockDateAndCancel(db: Db, day: string, reason: string | null) {
  await slots.addBlockedDate(db, day, reason);
  let notified = 0;
  const ids = await slots.listSlotIdsOn(db, day);
  for (const { id } of ids) notified += (await cancelSlotAndNotify(db, id)) ?? 0;
  return { cancelled: ids.length, notified };
}

/** Day-before reminders for slots (residents and confirmed volunteers). */
export async function sendSlotReminders(db: Db) {
  let sent = 0;
  for (const { id } of await slots.listTomorrowSlotIds(db)) {
    const slot = await slots.getSlot(db, id);
    if (!slot) continue;
    for (const b of await slots.listBookingsNeedingReminder(db, id)) {
      await notify(db, resident(b), templates.slotReminder("he", { name: firstName(b.name), slot: formatSlot(slot, "he") }));
      await slots.markBookingReminded(db, b.id);
      sent++;
    }
    for (const v of await slots.listVolunteersNeedingReminder(db, id)) {
      await notify(db, student(v), templates.slotReminder("en", { name: firstName(v.name), slot: formatSlot(slot, "en") }));
      await slots.markVolunteerReminded(db, v.id);
      sent++;
    }
  }
  return sent;
}

// ---------------------------------------------------------------- podcast

export async function joinPodcast(db: Db, input: podcast.ParticipantInput, baseUrl: string) {
  if (await misc.isBlocked(db, input.phone, input.email)) return "blocked" as const;
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

/**
 * Admin: pair two people (signed up themselves or added by staff), optionally with when and where
 * they first meet. With `notify`, each is told who their partner is and when they meet.
 */
export async function adminPairPodcast(db: Db, a: string, b: string, { meeting = null, notify: send = true }: { meeting?: podcast.Meeting | null; notify?: boolean } = {}) {
  const pairId = await podcast.makePair(db, a, b, "admin");
  if (!pairId) return null;
  if (meeting) await podcast.setPairMeeting(db, pairId, meeting);
  if (send) {
    const [pa, pb] = await Promise.all([podcast.getParticipant(db, a), podcast.getParticipant(db, b)]);
    if (pa && pb) {
      for (const [me, other] of [
        [pa, pb],
        [pb, pa],
      ] as const) {
        const locale = localeOf(me.portal);
        await notify(db, me, templates.podcastPairedByAdmin(locale, {
          name: firstName(me.name),
          partner: firstName(other.name),
          when: meeting ? formatDateTime(meeting.date, meeting.time, locale) : null,
          place: meeting?.place ?? null,
          // students get their partner's contact; residents are contacted by the team
          partnerContact: locale === "en" ? [other.email, formatPhone(other.phone)].filter(Boolean).join(", ") : undefined,
        }));
      }
    }
  }
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
