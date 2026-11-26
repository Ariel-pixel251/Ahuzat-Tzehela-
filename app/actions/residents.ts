"use server";

import { z } from "zod";
import { DIGITAL_NEEDS } from "@/config/options";
import { LANGUAGES } from "@/config/languages";
import { getCalendar, getEvent } from "@/lib/calendar";
import * as eventsDb from "@/lib/db/events";
import { clearCodeFailures, codeAttempt, createProblemReport, lookupStatus } from "@/lib/db/misc";
import * as podcastDb from "@/lib/db/podcast";
import * as slotsDb from "@/lib/db/slots";
import type { Db } from "@/lib/db/types";
import { bookDigital, cancelByCode, cancelEventRegistration, joinPodcast, leavePodcastByToken, registerEvent } from "@/lib/domain";
import { formatDateTime, formatEventWhen } from "@/lib/i18n/format";
import type { ActionState } from "@/lib/form";
import { residentsText, shared, studentsText } from "@/lib/i18n";
import { allowed, getBaseUrl, guardForm, invalid, withDb } from "@/lib/server";
import { form, formObject, v, validate } from "@/lib/validation";

const he = shared("he").errors;
// residents give only a name and a phone number (no email)
const contact = { name: v.name, phone: v.phone() };

/** "יום שני, 1 בדצמבר, בשעה 17:30" and the place, for the success screen. */
const slotDone = (x: { date: string; start_time: string; place_he: string }, token?: string) => ({
  when: formatDateTime(x.date, x.start_time, "he"),
  place: x.place_he,
  token,
});

// ---------------------------------------------------------------- event registration

export async function registerResidentForEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guardForm(db, fd, "residents:event", "he", { perDay: 20 });
    if (stop) return stop;
    const key = v.eventKey.safeParse(fd.get("event"));
    const event = key.success ? await getEvent(key.data) : null;
    if (!event) return { ok: false, message: he.notFound };
    const schema = form({
      ...contact,
      event: v.eventKey,
      attendees: v.int(1, 2),
      // language night: an optional row of languages
      languages: v.codes(LANGUAGES),
    });
    const r = validate(schema, formObject(fd, ["languages"]));
    if (!r.ok) return invalid(r.errors, "he");
    const done = { when: formatEventWhen(event, "he"), place: event.location?.he ?? null };
    const res = await registerEvent(
      db,
      event,
      {
        portal: "resident",
        name: r.data.name,
        phone: r.data.phone,
        email: null,
        attendees: r.data.attendees,
        notes: null,
        languages: r.data.languages,
        other_language: null,
        preferred_language: null,
        registered_by: null,
      },
      await getBaseUrl(),
    );
    // already signed up with this phone: the same calm success (no code, so nobody learns someone else's)
    if (res.status === "duplicate") return { ok: true, data: done };
    if (!("code" in res)) {
      const messages = { closed: he.closed, "not-registrable": he.notFound, blocked: he.unavailable };
      return { ok: false, message: messages[res.status] };
    }
    return { ok: true, code: res.code, waitlist: res.status === "waitlist", data: { ...done, token: res.token } };
  });
}

// ---------------------------------------------------------------- digital support: book a slot

export async function bookHelpSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guardForm(db, fd, "residents:help", "he", { perDay: 10 });
    if (stop) return stop;
    // what help is needed: optional, nothing chosen is fine
    const schema = form({ ...contact, slot: v.uuid, needs: v.codes(DIGITAL_NEEDS) });
    const r = validate(schema, formObject(fd, ["needs"]));
    if (!r.ok) return invalid(r.errors, "he");
    const res = await bookDigital(
      db,
      r.data.slot,
      { name: r.data.name, phone: r.data.phone, email: null, needs: r.data.needs, needs_other: null, registered_by: null },
      await getBaseUrl(),
    );
    const slot = await slotsDb.getSlot(db, r.data.slot);
    const done = slot ? slotDone({ ...slot, date: slot.slot_date }) : undefined;
    if (res.status === "booked") return { ok: true, code: res.code, data: done && { ...done, token: res.token } };
    if (res.status === "duplicate") return { ok: true, data: done };
    const messages = { not_found: he.slotClosed, closed: he.slotClosed, full: he.slotFull, blocked: he.unavailable };
    // back to screen 1, where another slot can be chosen
    return { ok: false, message: messages[res.status], errors: { slot: messages[res.status] } };
  });
}

// ---------------------------------------------------------------- podcast

export async function joinPodcastAsResident(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guardForm(db, fd, "residents:podcast", "he");
    if (stop) return stop;
    const schema = form({ ...contact, time: v.uuid, language: v.language });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return invalid(r.errors, "he");
    const res = await joinPodcast(
      db,
      {
        name: r.data.name,
        phone: r.data.phone,
        email: null,
        portal: "resident",
        // residents choose the topic together with their partner at the meeting
        topics: [],
        language: r.data.language,
        availability: null,
        registered_by: null,
        time_id: r.data.time,
      },
      await getBaseUrl(),
    );
    const time = await podcastDb.getPodcastTime(db, r.data.time);
    const done = time ? slotDone({ ...time, date: time.time_date }) : undefined;
    if (res.status === "joined") return { ok: true, code: res.code, data: done && { ...done, token: res.token } };
    if (res.status === "blocked") return { ok: false, message: he.unavailable };
    if (res.status === "duplicate") {
      // the same time again: the same success; another time: say so
      const existing = await podcastDb.getActiveParticipant(db, { phone: r.data.phone, email: null });
      if (existing?.time_id === r.data.time) return { ok: true, data: done };
      return { ok: false, message: residentsText.signup.alreadyInPodcast };
    }
    const message = res.status === "full" ? he.slotFull : he.slotClosed;
    return { ok: false, message, errors: { time: message } };
  });
}

// ---------------------------------------------------------------- report a problem

export async function reportProblemAsResident(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guardForm(db, fd, "residents:report", "he", { max: 5 });
    if (stop) return stop;
    const schema = form({
      message: v.text(2000, { multiline: true }),
      name: v.optionalText(100),
      phone: v.optionalPhone(),
    });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return invalid(r.errors, "he");
    await createProblemReport(db, { portal: "resident", name: r.data.name, contact: r.data.phone, message: r.data.message });
    return { ok: true };
  });
}

// ---------------------------------------------------------------- status by phone + code

export async function checkStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    // a 4-digit code must not be guessable: few tries per connection, and 5 wrong codes lock the phone number
    if (!(await allowed(db, "residents:status", 10, 3600))) return { ok: false, message: he.rateLimited };
    const r = validate(form({ phone: v.phone(), code: z.string().trim().regex(/^\d{4}$/, "text") }), formObject(fd));
    if (!r.ok) return invalid(r.errors, "he");
    // the attempt is counted first, so parallel requests can't get past the limit
    if (!(await codeAttempt(db, r.data.phone))) return { ok: false, message: he.locked };
    const items = await lookupStatus(db, r.data.phone, r.data.code);
    if (!items.length) return { ok: false, message: residentsText.pages.status.notFound };
    await clearCodeFailures(db, r.data.phone);
    return { ok: true, data: items };
  });
}

// ---------------------------------------------------------------- cancel (status page with the code; the success screen with its token)

export async function cancelWithCode(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    if (!(await allowed(db, "residents:status", 10, 3600))) return { ok: false, message: he.rateLimited };
    const r = validate(form({ phone: v.phone(), code: z.string().trim().regex(/^\d{4}$/, "text") }), formObject(fd));
    if (!r.ok) return invalid(r.errors, "he");
    if (!(await codeAttempt(db, r.data.phone))) return { ok: false, message: he.locked };
    const n = await cancelByCode(db, r.data.phone, r.data.code, getCalendar);
    if (!n) return { ok: false, message: residentsText.pages.status.notFound };
    await clearCodeFailures(db, r.data.phone);
    return { ok: true, message: residentsText.signup.cancelled };
  });
}

/** The token-guarded cancels are rate-limited too, so tokens can't be guessed. */
async function tokenFrom(db: Db, fd: FormData, locale: "he" | "en") {
  if (!(await allowed(db, `${locale}:cancel`, 20, 600))) return null;
  const token = v.token.safeParse(fd.get("token"));
  return token.success ? token.data : null;
}

export async function cancelHelpByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const t = residentsText.pages.manage;
    const token = await tokenFrom(db, fd, "he");
    const booking = token ? await slotsDb.getBookingByToken(db, token) : null;
    if (!booking || !(await slotsDb.cancelBooking(db, booking.id))) return { ok: false, message: t.invalid };
    return { ok: true, message: t.cancelled };
  });
}

export async function cancelPodcastByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const token = await tokenFrom(db, fd, "he");
    if (!token || !(await leavePodcastByToken(db, token))) return { ok: false, message: residentsText.pages.manage.invalid };
    return { ok: true, message: residentsText.signup.cancelled };
  });
}

export async function cancelRegistrationByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  const locale = fd.get("locale") === "en" ? "en" : "he";
  return withDb(locale, async (db) => {
    const invalidLink = locale === "en" ? studentsText.manage.invalid : residentsText.pages.manage.invalid;
    const token = await tokenFrom(db, fd, locale);
    const reg = token ? await eventsDb.getRegistrationByToken(db, token) : null;
    if (!reg || reg.status === "cancelled") return { ok: false, message: invalidLink };
    await cancelEventRegistration(db, reg, await getCalendar());
    return { ok: true };
  });
}
