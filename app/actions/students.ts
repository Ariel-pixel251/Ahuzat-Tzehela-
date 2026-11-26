"use server";

import { revalidatePath } from "next/cache";
import { LANGUAGES } from "@/config/languages";
import { PODCAST_TOPICS } from "@/config/options";
import { eventForm, getEvent } from "@/lib/calendar";
import { createProblemReport, hitRateLimit, isBlocked } from "@/lib/db/misc";
import { acceptConduct, saveProfile, upsertStudent } from "@/lib/db/students";
import { cancelVolunteerByToken, joinPodcast, leavePodcastByToken, registerEvent, studentCancelCutoffHours, volunteerForSlot } from "@/lib/domain";
import { studentEmailAllowed, studentEmailDomains } from "@/lib/env";
import type { ActionState } from "@/lib/form";
import { shared, studentsText as t } from "@/lib/i18n";
import { getBaseUrl, guardForm, invalid, withDb } from "@/lib/server";
import { form, formObject, v, validate } from "@/lib/validation";

const en = shared("en").errors;
const intl = { international: true };

// ---------------------------------------------------------------- event registration

export async function registerStudentForEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:event", "en");
    if (stop) return stop;
    const key = v.eventKey.safeParse(fd.get("event"));
    const event = key.success ? await getEvent(key.data) : null;
    if (!event) return { ok: false, message: en.notFound };
    const kind = eventForm(event);
    const languageNight = kind === "language-night";
    const schema = form({
      event: v.eventKey,
      name: v.name,
      email: v.email,
      // language night asks everyone for a phone number
      phone: languageNight ? v.phone(intl) : v.optionalPhone(intl),
      attendees: v.int(1, 10),
      notes: v.optionalText(500, { multiline: true }),
      languages: v.codes(LANGUAGES, { min: languageNight ? 1 : 0 }),
      other_language: v.optionalText(60),
      preferred_language: v.optionalLanguage,
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd, ["languages"]));
    if (!r.ok) return invalid(r.errors, "en");
    const res = await registerEvent(
      db,
      event,
      {
        portal: "student",
        name: r.data.name,
        email: r.data.email,
        phone: r.data.phone,
        attendees: r.data.attendees,
        notes: r.data.notes,
        languages: r.data.languages,
        other_language: r.data.other_language,
        preferred_language: kind === "game-night" ? r.data.preferred_language : null,
        registered_by: null,
      },
      await getBaseUrl(),
    );
    if (!("code" in res)) {
      const messages = { duplicate: en.duplicate, closed: en.closed, "not-registrable": en.notFound, blocked: en.unavailable };
      return { ok: false, message: messages[res.status] };
    }
    return { ok: true, code: res.code, waitlist: res.status === "waitlist" };
  });
}

// ---------------------------------------------------------------- sign-up from a card (no account)

/** The school email is the only identity check, so it must be a school address (when the rule is set). */
function schoolEmailError(email: string) {
  const domains = studentEmailDomains();
  return studentEmailAllowed(email, domains) ? null : t.card.schoolEmailOnly(domains.map((x) => `@${x}`).join(", "));
}

/** Digital support: name, school email, age (a parent or guardian for under-18s), and the privacy notice and code of conduct. */
export async function signUpForSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:slot", "en", { max: 10 });
    if (stop) return stop;
    const schema = form({
      slot: v.uuid,
      name: v.name,
      email: v.email,
      under_18: v.checkbox,
      guardian_name: v.optionalText(100),
      guardian_phone: v.optionalPhone(intl),
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return invalid(r.errors, "en");
    const d = r.data;
    const emailError = schoolEmailError(d.email);
    if (emailError) return { ok: false, errors: { email: emailError } };
    if (d.under_18 && !(d.guardian_name && d.guardian_phone)) {
      const errors: Record<string, string> = {};
      if (!d.guardian_name) errors.guardian_name = t.card.guardianRequired;
      if (!d.guardian_phone) errors.guardian_phone = t.card.guardianRequired;
      return { ok: false, errors };
    }
    // by email too, so nobody can fill a slot by changing their IP address
    if (!(await hitRateLimit(db, `students:slot:${d.email}`, 10, 3600))) return { ok: false, message: t.card.tooMany };
    if (await isBlocked(db, null, d.email)) return { ok: false, message: en.unavailable };
    const student = await upsertStudent(db, { name: d.name, email: d.email, phone: null });
    await saveProfile(db, student.id, {
      phone: null,
      age_group: d.under_18 ? "under-18" : "18-plus",
      guardian_name: d.under_18 ? d.guardian_name : null,
      guardian_phone: d.under_18 ? d.guardian_phone : null,
    });
    await acceptConduct(db, student.id);
    // no revalidatePath here: the card must keep showing "You're in" even when the slot is now full
    const result = await volunteerForSlot(db, d.slot, student, await getBaseUrl());
    if (result === "confirmed" || result === "pending") {
      return { ok: true, message: result === "pending" ? t.digital.pending : t.digital.reminder };
    }
    const messages = { full: t.digital.full, duplicate: t.digital.alreadyIn, closed: t.digital.notOpen, not_found: t.digital.notOpen, blocked: en.unavailable };
    return { ok: false, message: messages[result] };
  });
}

/** Podcast: name, school email, one topic, language, and the privacy notice. */
export async function signUpForPodcastTime(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:podcast", "en", { max: 10 });
    if (stop) return stop;
    const schema = form({
      time: v.uuid,
      name: v.name,
      email: v.email,
      topic: v.choice(PODCAST_TOPICS.map((x) => x.code)),
      language: v.language,
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return invalid(r.errors, "en");
    const d = r.data;
    const emailError = schoolEmailError(d.email);
    if (emailError) return { ok: false, errors: { email: emailError } };
    if (!(await hitRateLimit(db, `students:podcast:${d.email}`, 10, 3600))) return { ok: false, message: t.card.tooMany };
    const res = await joinPodcast(
      db,
      { name: d.name, email: d.email, phone: null, topics: [d.topic], language: d.language, availability: null, time_id: d.time, portal: "student", registered_by: null },
      await getBaseUrl(),
    );
    // no revalidatePath here: the card must keep showing "You're in" even when the time is now full
    if (res.status === "joined") return { ok: true, message: t.podcast.pending };
    const messages = { blocked: en.unavailable, duplicate: t.podcast.alreadyIn, full: t.podcast.full, closed: t.podcast.closed, not_found: t.podcast.closed };
    return { ok: false, message: messages[res.status] };
  });
}

// ---------------------------------------------------------------- cancel with the link from the email

export async function cancelSlotPlaceByToken(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    // rate-limited: links must not be guessed
    const stop = await guardForm(db, fd, "students:cancel", "en", { max: 20 });
    if (stop) return stop;
    const token = v.token.safeParse(fd.get("token"));
    const result = token.success ? await cancelVolunteerByToken(db, token.data) : "invalid";
    revalidatePath("/students/digital-support");
    if (result === "cancelled") return { ok: true, message: t.digital.cancelled };
    if (result === "too_late") return { ok: false, message: t.digital.cancelTooLate(await studentCancelCutoffHours(db)) };
    return { ok: false, message: t.digital.invalid };
  });
}

export async function leavePodcast(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:cancel", "en", { max: 20 });
    if (stop) return stop;
    const token = v.token.safeParse(fd.get("token"));
    const left = token.success && (await leavePodcastByToken(db, token.data));
    revalidatePath("/students/podcast");
    return left ? { ok: true, message: t.podcast.cancelled } : { ok: false, message: t.podcast.invalid };
  });
}

// ---------------------------------------------------------------- report a problem

export async function reportProblemAsStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:report", "en", { max: 5 });
    if (stop) return stop;
    const schema = form({
      message: v.text(2000, { multiline: true }),
      name: v.optionalText(100),
      contact: v.optionalText(200),
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return invalid(r.errors, "en");
    await createProblemReport(db, { portal: "student", name: r.data.name, contact: r.data.contact, message: r.data.message });
    return { ok: true, message: t.report.thanks };
  });
}

