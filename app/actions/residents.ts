"use server";

import { z } from "zod";
import { DIGITAL_NEEDS, PODCAST_TOPICS } from "@/config/options";
import { LANGUAGES } from "@/config/languages";
import { eventForm, getCalendar, getEvent } from "@/lib/calendar";
import * as eventsDb from "@/lib/db/events";
import { clearCodeFailures, codeAttempt, createProblemReport, lookupStatus } from "@/lib/db/misc";
import * as podcastDb from "@/lib/db/podcast";
import * as slotsDb from "@/lib/db/slots";
import { bookDigital, cancelEventRegistration, joinPodcast, registerEvent } from "@/lib/domain";
import type { ActionState } from "@/lib/form";
import { residentsText, shared, studentsText } from "@/lib/i18n";
import { allowed, getBaseUrl, guardForm, invalid, withDb } from "@/lib/server";
import { form, formObject, v, validate } from "@/lib/validation";

const he = shared("he").errors;
const contact = { name: v.name, phone: v.phone(), email: v.optionalEmail };

// ---------------------------------------------------------------- event registration

export async function registerResidentForEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guardForm(db, fd, "residents:event", "he", { perDay: 20 });
    if (stop) return stop;
    const key = v.eventKey.safeParse(fd.get("event"));
    const event = key.success ? await getEvent(key.data) : null;
    if (!event) return { ok: false, message: he.notFound };
    const kind = eventForm(event);
    const wantsLanguages = kind === "language-night" || event.languages;

    const schema = form({
      ...contact,
      event: v.eventKey,
      attendees: v.int(1, 10),
      languages: v.codes(LANGUAGES, { min: wantsLanguages ? 1 : 0 }),
      other_language: v.optionalText(60),
      preferred_language: v.optionalLanguage,
    });
    const r = validate(schema, formObject(fd, ["languages"]));
    if (!r.ok) return invalid(r.errors, "he");

    const res = await registerEvent(
      db,
      event,
      {
        portal: "resident",
        name: r.data.name,
        phone: r.data.phone,
        email: r.data.email,
        attendees: r.data.attendees,
        notes: null,
        languages: r.data.languages,
        other_language: r.data.other_language,
        preferred_language: kind === "game-night" ? r.data.preferred_language : null,
        registered_by: null,
      },
      await getBaseUrl(),
    );
    if (!("code" in res)) {
      const messages = { duplicate: he.duplicate, closed: he.closed, "not-registrable": he.notFound, blocked: he.unavailable };
      return { ok: false, message: messages[res.status] };
    }
    return { ok: true, code: res.code, waitlist: res.status === "waitlist" };
  });
}

// ---------------------------------------------------------------- digital support: book a slot

export async function bookHelpSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guardForm(db, fd, "residents:help", "he", { perDay: 10 });
    if (stop) return stop;
    const schema = form({
      ...contact,
      slot: v.uuid,
      needs: v.codes(DIGITAL_NEEDS, { min: 1 }),
      needs_other: v.optionalText(300),
    });
    const r = validate(schema, formObject(fd, ["needs"]));
    if (!r.ok) return invalid(r.errors, "he");
    const res = await bookDigital(
      db,
      r.data.slot,
      {
        name: r.data.name,
        phone: r.data.phone,
        email: r.data.email,
        needs: r.data.needs,
        needs_other: r.data.needs_other,
        registered_by: null,
      },
      await getBaseUrl(),
    );
    if (res.status === "booked") {
      const slot = await slotsDb.getSlot(db, r.data.slot);
      return { ok: true, code: res.code, data: slot ? { slot: { slot_date: slot.slot_date, start_time: slot.start_time, end_time: slot.end_time, place_he: slot.place_he, place_en: slot.place_en } } : undefined };
    }
    const messages = { not_found: he.slotClosed, closed: he.slotClosed, full: he.slotFull, duplicate: he.slotDuplicate, blocked: he.unavailable };
    // send the person back to the time question, where they can pick another slot
    return { ok: false, message: messages[res.status], errors: { slot: messages[res.status] } };
  });
}

// ---------------------------------------------------------------- podcast

export async function joinPodcastAsResident(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guardForm(db, fd, "residents:podcast", "he");
    if (stop) return stop;
    const schema = form({
      ...contact,
      topics: v.codes(PODCAST_TOPICS, { min: 1 }),
      language: v.language,
      time: v.podcastTime,
    });
    const r = validate(schema, formObject(fd, ["topics"]));
    if (!r.ok) return invalid(r.errors, "he");
    const res = await joinPodcast(
      db,
      {
        name: r.data.name,
        phone: r.data.phone,
        email: r.data.email,
        portal: "resident",
        topics: r.data.topics,
        language: r.data.language,
        availability: null,
        registered_by: null,
        time_id: r.data.time,
      },
      await getBaseUrl(),
    );
    if (res === "blocked") return { ok: false, message: he.unavailable };
    if (res.status === "duplicate") return { ok: false, message: he.alreadyJoined };
    if (res.status !== "joined") {
      const message = res.status === "full" ? he.slotFull : he.slotClosed;
      // back to the time question, where another time can be chosen
      return { ok: false, message, errors: { time: message } };
    }
    const time = r.data.time ? await podcastDb.getPodcastTime(db, r.data.time) : null;
    return { ok: true, code: res.code, data: time ? { slot: { ...time, slot_date: time.time_date } } : undefined };
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

// ---------------------------------------------------------------- cancel links (only for people who gave an email)

export async function cancelHelpByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const t = residentsText.pages.manage;
    const token = v.token.safeParse(fd.get("token"));
    if (!token.success) return { ok: false, message: t.invalid };
    const booking = await slotsDb.getBookingByToken(db, token.data);
    if (!booking || !(await slotsDb.cancelBooking(db, booking.id))) return { ok: false, message: t.invalid };
    return { ok: true, message: t.cancelled };
  });
}

export async function cancelRegistrationByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  const locale = fd.get("locale") === "en" ? "en" : "he";
  return withDb(locale, async (db) => {
    const invalidLink = locale === "en" ? studentsText.manage.invalid : residentsText.pages.manage.invalid;
    const token = v.token.safeParse(fd.get("token"));
    if (!token.success) return { ok: false, message: invalidLink };
    const reg = await eventsDb.getRegistrationByToken(db, token.data);
    if (!reg || reg.status === "cancelled") return { ok: false, message: invalidLink };
    await cancelEventRegistration(db, reg, await getCalendar());
    return { ok: true };
  });
}
