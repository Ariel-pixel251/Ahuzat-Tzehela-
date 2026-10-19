"use server";

import { z } from "zod";
import { DAYS, DIGITAL_NEEDS, formatHours, HOURS, MEMORIAL_ROLES, PODCAST_TOPICS } from "@/config/options";
import { LANGUAGES } from "@/config/languages";
import { eventForm, getCalendar, getEvent } from "@/lib/calendar";
import * as digitalDb from "@/lib/db/digital";
import * as eventsDb from "@/lib/db/events";
import { createCallback, listLessonTopics, lookupStatus } from "@/lib/db/misc";
import type { Db } from "@/lib/db/types";
import {
  cancelEventRegistration,
  createDigital,
  createLecture,
  createLesson,
  joinPodcast,
  registerEvent,
} from "@/lib/domain";
import type { ActionState } from "@/lib/form";
import { residentsText, shared, studentsText } from "@/lib/i18n";
import { allowed, getBaseUrl, localizeErrors, withDb } from "@/lib/server";
import { formObject, isBot, v, validate } from "@/lib/validation";

const he = shared("he").errors;

/** Honeypot and rate limit, shared by every resident form. Returns a state to stop, or null to go on. */
async function guard(db: Db, fd: FormData, action: string): Promise<ActionState> {
  // bots get a normal-looking answer and nothing is saved
  if (isBot(fd)) return { ok: true, code: "0000" };
  if (!(await allowed(db, `residents:${action}`))) return { ok: false, message: he.rateLimited };
  return null;
}

const contact = { name: v.name, phone: v.phone(), email: v.optionalEmail };

/** Availability as "English | עברית", following the site's bilingual convention. */
function availabilityText(days: string[], hours: string[]) {
  const part = (locale: "en" | "he") =>
    [days.map((c) => DAYS.find((o) => o.code === c)?.[locale] ?? c).join(", "), formatHours(hours, locale)].filter(Boolean).join(" · ");
  return days.length || hours.length ? `${part("en")} | ${part("he")}` : null;
}

// ---------------------------------------------------------------- event registration

export async function registerResidentForEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guard(db, fd, "event");
    if (stop) return stop;
    const event = await getEvent(String(fd.get("event") ?? ""));
    if (!event) return { ok: false, message: he.notFound };
    const form = eventForm(event);
    const wantsLanguages = form === "language-night" || event.languages;

    const schema = z.object({
      ...contact,
      attendees: v.int(1, 10),
      languages: v.codes(LANGUAGES, { min: wantsLanguages ? 1 : 0 }),
      other_language: v.optionalText(60),
      preferred_language: v.optionalLanguage,
      role: form === "memorial" ? v.choice(MEMORIAL_ROLES.resident.map((r) => r.code)) : z.string().optional(),
    });
    const r = validate(schema, formObject(fd, ["languages"]));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "he") };

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
        preferred_language: form === "game-night" ? r.data.preferred_language : null,
        role: form === "memorial" ? (r.data.role ?? null) : null,
        registered_by: null,
      },
      await getBaseUrl(),
    );
    if (!("code" in res)) return { ok: false, message: { duplicate: he.duplicate, closed: he.closed, "not-registrable": he.notFound }[res.status] };
    return { ok: true, code: res.code, waitlist: res.status === "waitlist" };
  });
}

// ---------------------------------------------------------------- digital support

export async function requestHelp(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guard(db, fd, "help");
    if (stop) return stop;
    const schema = z.object({
      ...contact,
      needs: v.codes(DIGITAL_NEEDS, { min: 1 }),
      needs_other: v.optionalText(300),
      days: v.codes(DAYS),
      hours: v.codes(HOURS),
      language: v.language,
    });
    const r = validate(schema, formObject(fd, ["needs", "days", "hours"]));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "he") };
    const res = await createDigital(
      db,
      {
        resident_name: r.data.name,
        resident_phone: r.data.phone,
        resident_email: r.data.email,
        needs: r.data.needs,
        needs_other: r.data.needs_other,
        preferred_days: r.data.days,
        preferred_parts: r.data.hours,
        language: r.data.language,
        registered_by: null,
      },
      await getBaseUrl(),
    );
    return { ok: true, code: res.code };
  });
}

// ---------------------------------------------------------------- podcast

export async function joinPodcastAsResident(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guard(db, fd, "podcast");
    if (stop) return stop;
    const schema = z.object({
      ...contact,
      topics: v.codes(PODCAST_TOPICS, { min: 1 }),
      language: v.language,
      days: v.codes(DAYS),
      hours: v.codes(HOURS),
    });
    const r = validate(schema, formObject(fd, ["topics", "days", "hours"]));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "he") };
    const res = await joinPodcast(
      db,
      {
        name: r.data.name,
        phone: r.data.phone,
        email: r.data.email,
        portal: "resident",
        topics: r.data.topics,
        language: r.data.language,
        availability: availabilityText(r.data.days, r.data.hours),
        registered_by: null,
      },
      await getBaseUrl(),
    );
    if (!res) return { ok: false, message: he.alreadyJoined };
    return { ok: true, code: res.code };
  });
}

// ---------------------------------------------------------------- lecture proposal

export async function proposeLecture(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guard(db, fd, "lecture");
    if (stop) return stop;
    const schema = z.object({
      ...contact,
      topic: v.text(200),
      language: v.language,
      preferred_date: v.optionalText(100),
      description: v.optionalText(1000),
    });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "he") };
    const res = await createLecture(db, { ...r.data, registered_by: null });
    return { ok: true, code: res.code };
  });
}

// ---------------------------------------------------------------- call me back

export async function requestCallback(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guard(db, fd, "callback");
    if (stop) return stop;
    const r = validate(z.object({ name: v.name, phone: v.phone() }), formObject(fd));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "he") };
    await createCallback(db, { ...r.data, registered_by: null });
    return { ok: true };
  });
}

// ---------------------------------------------------------------- private lessons

export async function requestLesson(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const stop = await guard(db, fd, "lesson");
    if (stop) return stop;
    const topics = (await listLessonTopics(db)).map((t) => ({ code: t.id }));
    const schema = z
      .object({ ...contact, topics: v.codes(topics), other_topic: v.optionalText(200) })
      .refine((d) => d.topics.length > 0 || d.other_topic, { message: "choose", path: ["topics"] });
    const r = validate(schema, formObject(fd, ["topics"]));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "he") };
    const res = await createLesson(db, {
      role: "learn",
      portal: "resident",
      name: r.data.name,
      phone: r.data.phone,
      email: r.data.email,
      topics: r.data.topics,
      other_topic: r.data.other_topic,
      notes: null,
      registered_by: null,
    });
    return { ok: true, code: res.code };
  });
}

// ---------------------------------------------------------------- status by phone + code

export async function checkStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    // stricter limit: a 4-digit code must not be guessable
    if (!(await allowed(db, "residents:status", 10, 3600))) return { ok: false, message: he.rateLimited };
    const r = validate(z.object({ phone: v.phone(), code: z.string().trim().regex(/^\d{4}$/, "text") }), formObject(fd));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "he") };
    const items = await lookupStatus(db, r.data.phone, r.data.code);
    if (!items.length) return { ok: false, message: residentsText.pages.status.notFound };
    return { ok: true, data: items };
  });
}

// ---------------------------------------------------------------- edit links (only for residents who gave an email)

export async function cancelHelpByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("he", async (db) => {
    const ok = await digitalDb.cancelDigitalRequestByToken(db, String(fd.get("token") ?? ""));
    return ok ? { ok: true, message: residentsText.pages.manage.cancelled } : { ok: false, message: residentsText.pages.manage.invalid };
  });
}

export async function cancelRegistrationByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  const locale = fd.get("locale") === "en" ? "en" : "he";
  return withDb(locale, async (db) => {
    const reg = await eventsDb.getRegistrationByToken(db, String(fd.get("token") ?? ""));
    if (!reg || reg.status === "cancelled") {
      return { ok: false, message: locale === "en" ? studentsText.manage.invalid : residentsText.pages.manage.invalid };
    }
    await cancelEventRegistration(db, reg, await getCalendar());
    return { ok: true };
  });
}
