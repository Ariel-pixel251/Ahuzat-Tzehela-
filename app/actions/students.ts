"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LANGUAGES } from "@/config/languages";
import { AGE_GROUPS, PODCAST_TOPICS } from "@/config/options";
import { currentStudent, STUDENT_COOKIE } from "@/lib/auth/student";
import { eventForm, getEvent } from "@/lib/calendar";
import { createProblemReport, hitRateLimit, isBlocked } from "@/lib/db/misc";
import * as podcastDb from "@/lib/db/podcast";
import * as slotsDb from "@/lib/db/slots";
import { acceptConduct, createLoginToken, deleteSession, exchangeLoginToken, profileComplete, saveProfile, upsertStudent } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import { joinPodcast, registerEvent, requestPodcastPair, respondPodcastRequest, studentCancelCutoffHours, volunteerForSlot } from "@/lib/domain";
import { studentEmailAllowed, studentEmailDomains } from "@/lib/env";
import type { ActionState } from "@/lib/form";
import { shared, studentsText as t } from "@/lib/i18n";
import { sendEmail } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
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

// ---------------------------------------------------------------- podcast

export async function joinPodcastAsStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:podcast", "en");
    if (stop) return stop;
    const schema = form({
      name: v.name,
      email: v.email,
      phone: v.optionalPhone(intl),
      topics: v.codes(PODCAST_TOPICS, { min: 1 }),
      language: v.language,
      time: v.podcastTime,
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd, ["topics"]));
    if (!r.ok) return invalid(r.errors, "en");
    const domains = studentEmailDomains();
    if (!studentEmailAllowed(r.data.email, domains)) {
      return { ok: false, errors: { email: t.signIn.schoolEmailOnly(domains.map((x) => `@${x}`).join(", ")) } };
    }
    const d = r.data;
    const input = { name: d.name, email: d.email, phone: d.phone, topics: d.topics, language: d.language, availability: null, time_id: d.time };
    const res = await joinPodcast(db, { ...input, portal: "student", registered_by: null }, await getBaseUrl());
    if (res === "blocked") return { ok: false, message: en.unavailable };
    if (res.status === "duplicate") return { ok: false, message: en.alreadyJoined };
    if (res.status !== "joined") {
      const message = res.status === "full" ? en.slotFull : en.slotClosed;
      return { ok: false, message, errors: { time: message } };
    }
    revalidatePath("/students/podcast");
    // the private link goes only to the inbox (owning the email is the proof); on screen only in local development
    return { ok: true, data: process.env.NODE_ENV !== "production" ? { devLink: `/students/podcast/manage?token=${res.token}` } : undefined };
  });
}

/** The podcast participant behind a private-page token (rate-limited: tokens must not be guessed). */
async function participantFromToken(db: Db, fd: FormData) {
  const token = v.token.safeParse(fd.get("token"));
  if (!token.success) return null;
  return podcastDb.getParticipantByToken(db, token.data);
}

export async function askToPair(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:pair", "en", { max: 20 });
    if (stop) return stop;
    const me = await participantFromToken(db, fd);
    const target = v.uuid.safeParse(fd.get("target"));
    if (!me || !target.success) return { ok: false, message: t.podcast.invalid };
    // students ask students; residents are paired by the team (so nobody can message residents)
    const other = await podcastDb.getParticipant(db, target.data);
    if (!other || other.portal !== "student") return { ok: false, message: t.podcast.unavailable };
    const result = await requestPodcastPair(db, me.id, target.data);
    revalidatePath("/students/podcast/manage");
    const messages = {
      requested: t.podcast.requested,
      paired: t.podcast.paired,
      already_requested: t.podcast.alreadyRequested,
      unavailable: t.podcast.unavailable,
    };
    return { ok: result === "requested" || result === "paired", message: messages[result] };
  });
}

export async function answerPairRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:pair", "en", { max: 20 });
    if (stop) return stop;
    const me = await participantFromToken(db, fd);
    const request = v.uuid.safeParse(fd.get("request"));
    if (!me || !request.success) return { ok: false, message: t.podcast.invalid };
    const accept = fd.get("accept") === "yes";
    const result = await respondPodcastRequest(db, request.data, me.id, accept);
    revalidatePath("/students/podcast/manage");
    if (result === "unavailable") return { ok: false, message: t.podcast.unavailable };
    return { ok: true, message: result === "paired" ? t.podcast.paired : t.podcast.declined };
  });
}

export async function leavePodcast(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:pair", "en", { max: 20 });
    if (stop) return stop;
    const me = await participantFromToken(db, fd);
    if (!me) return { ok: false, message: t.podcast.invalid };
    await podcastDb.withdraw(db, me.id);
    revalidatePath("/students/podcast");
    return { ok: true, message: t.podcast.left };
  });
}

// ---------------------------------------------------------------- student sign-in (magic link)

export async function requestSignInLink(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:signin", "en", { max: 5 });
    if (stop) return stop;
    const r = validate(form({ name: v.name, email: v.email, phone: v.optionalPhone(intl), consent: v.consent }), formObject(fd));
    if (!r.ok) return invalid(r.errors, "en");
    // students see residents' phone numbers, so sign-in can be limited to school addresses
    const domains = studentEmailDomains();
    if (!studentEmailAllowed(r.data.email, domains)) {
      return { ok: false, errors: { email: t.signIn.schoolEmailOnly(domains.map((d) => `@${d}`).join(", ")) } };
    }
    if (await isBlocked(db, r.data.phone, r.data.email)) return { ok: false, message: en.unavailable };
    const student = await upsertStudent(db, r.data);
    const token = await createLoginToken(db, student.id);
    if (!token) return { ok: false, message: t.signIn.tooMany };
    const url = `${await getBaseUrl()}/students/auth?token=${token}`;
    const sent = await sendEmail(r.data.email, templates.studentSignIn({ name: student.name.split(" ")[0], url }));
    // without an email provider (local development only), show the link on screen
    if (sent === "logged" && process.env.NODE_ENV !== "production") return { ok: true, data: { devLink: url } };
    if (sent === "logged") return { ok: false, message: en.emailNotSetUp };
    if (sent !== "sent") return { ok: false, message: en.generic };
    return { ok: true, message: t.signIn.sent };
  });
}

export async function completeSignIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await withDb("en", async (db) => {
    const stop = await guardForm(db, fd, "students:auth", "en", { max: 10 });
    if (stop) return stop;
    const token = v.token.safeParse(fd.get("token"));
    const session = token.success ? await exchangeLoginToken(db, token.data) : null;
    if (!session) return { ok: false, message: t.signIn.invalid };
    (await cookies()).set(STUDENT_COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAgeSeconds,
    });
    return { ok: true };
  });
  if (res?.ok) redirect("/students/mine");
  return res;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(STUDENT_COOKIE)?.value;
  if (token) {
    await withDb("en", async (db) => {
      await deleteSession(db, token);
      return null;
    });
  }
  store.delete(STUDENT_COOKIE);
  redirect("/students/digital-support");
}

// ---------------------------------------------------------------- profile and code of conduct

async function withStudent(fn: (db: Db, student: NonNullable<Awaited<ReturnType<typeof currentStudent>>>) => Promise<ActionState>) {
  return withDb("en", async (db) => {
    const student = await currentStudent(db);
    if (!student) return { ok: false, message: t.digital.signInToVolunteer };
    if (await isBlocked(db, student.phone, student.email)) return { ok: false, message: en.unavailable };
    return fn(db, student);
  });
}

export async function saveStudentProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  return withStudent(async (db, student) => {
    const schema = form({
      phone: v.optionalPhone(intl),
      age_group: v.choice(AGE_GROUPS.map((a) => a.code)),
      guardian_name: v.optionalText(100),
      guardian_phone: v.optionalPhone(intl),
      guardian_confirm: v.checkbox,
    });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return invalid(r.errors, "en");
    const minor = r.data.age_group === "under-18";
    if (minor && !(r.data.guardian_name && r.data.guardian_phone && r.data.guardian_confirm)) {
      return { ok: false, message: t.mine.guardianRequired };
    }
    await saveProfile(db, student.id, {
      phone: r.data.phone,
      age_group: r.data.age_group,
      guardian_name: minor ? r.data.guardian_name : null,
      guardian_phone: minor ? r.data.guardian_phone : null,
    });
    revalidatePath("/students/mine");
    return { ok: true, message: t.mine.profileSaved };
  });
}

export async function acceptCodeOfConduct(_: ActionState, fd: FormData): Promise<ActionState> {
  return withStudent(async (db, student) => {
    if (fd.get("accept") !== "on") return { ok: false, errors: { accept: en.consent } };
    await acceptConduct(db, student.id);
    revalidatePath("/students/mine");
    return { ok: true, message: t.mine.conductAccepted };
  });
}

// ---------------------------------------------------------------- digital support: volunteer for slots

export async function volunteerForSlotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return withStudent(async (db, student) => {
    if (!student.email || !studentEmailAllowed(student.email)) return { ok: false, message: t.digital.signInToVolunteer };
    if (!profileComplete(student)) return { ok: false, message: t.digital.profileNeeded };
    if (!(await hitRateLimit(db, `students:volunteer:${student.id}`, 10, 3600))) return { ok: false, message: t.digital.tooMany };
    const slot = v.uuid.safeParse(fd.get("slot"));
    if (!slot.success) return { ok: false, message: t.digital.notOpen };
    const result = await volunteerForSlot(db, slot.data, student, await getBaseUrl());
    revalidatePath("/students/digital-support");
    revalidatePath("/students/mine");
    const messages = {
      confirmed: t.digital.volunteered,
      pending: t.digital.pending,
      full: t.digital.full,
      duplicate: t.digital.alreadyIn,
      closed: t.digital.notOpen,
      not_found: t.digital.notOpen,
      blocked: en.unavailable,
    };
    return { ok: result === "confirmed" || result === "pending", message: messages[result] };
  });
}

export async function cancelMyPlace(_: ActionState, fd: FormData): Promise<ActionState> {
  return withStudent(async (db, student) => {
    const id = v.uuid.safeParse(fd.get("volunteer"));
    const cutoff = await studentCancelCutoffHours(db);
    if (!id.success || !(await slotsDb.cancelOwnVolunteering(db, id.data, student.id, cutoff))) {
      return { ok: false, message: t.mine.cancelTooLate(cutoff) };
    }
    revalidatePath("/students/mine");
    revalidatePath("/students/digital-support");
    return { ok: true, message: t.mine.cancelled };
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

