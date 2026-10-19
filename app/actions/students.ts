"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LANGUAGES } from "@/config/languages";
import { MEMORIAL_ROLES, PODCAST_TOPICS } from "@/config/options";
import { currentStudent, STUDENT_COOKIE } from "@/lib/auth/student";
import { eventForm, getEvent } from "@/lib/calendar";
import * as digitalDb from "@/lib/db/digital";
import { createVisitRequest, listLessonTopics } from "@/lib/db/misc";
import * as podcastDb from "@/lib/db/podcast";
import {
  acceptConduct,
  createLoginToken,
  deleteSession,
  exchangeLoginToken,
  upsertStudent,
} from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import {
  claimDigital,
  createLesson,
  joinPodcast,
  registerEvent,
  requestPodcastPair,
  respondPodcastRequest,
} from "@/lib/domain";
import type { ActionState } from "@/lib/form";
import { shared, studentsText as t } from "@/lib/i18n";
import { sendEmail } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
import { allowed, getBaseUrl, localizeErrors, withDb } from "@/lib/server";
import { formObject, isBot, v, validate } from "@/lib/validation";

const en = shared("en").errors;

async function guard(db: Db, fd: FormData, action: string): Promise<ActionState> {
  if (isBot(fd)) return { ok: true };
  if (!(await allowed(db, `students:${action}`))) return { ok: false, message: en.rateLimited };
  return null;
}

const intl = { international: true };

// ---------------------------------------------------------------- event registration

export async function registerStudentForEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guard(db, fd, "event");
    if (stop) return stop;
    const event = await getEvent(String(fd.get("event") ?? ""));
    if (!event) return { ok: false, message: en.notFound };
    const form = eventForm(event);
    const languageNight = form === "language-night";
    const schema = z.object({
      name: v.name,
      email: v.email,
      // language night asks everyone for a phone number
      phone: languageNight ? v.phone(intl) : v.optionalPhone(intl),
      attendees: v.int(1, 10),
      notes: v.optionalText(500),
      languages: v.codes(LANGUAGES, { min: languageNight ? 1 : 0 }),
      other_language: v.optionalText(60),
      preferred_language: v.optionalLanguage,
      role: form === "memorial" ? v.choice(MEMORIAL_ROLES.student.map((r) => r.code)) : z.string().optional(),
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd, ["languages"]));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
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
        preferred_language: form === "game-night" ? r.data.preferred_language : null,
        role: form === "memorial" ? (r.data.role ?? null) : null,
        registered_by: null,
      },
      await getBaseUrl(),
    );
    if (!("code" in res)) {
      return { ok: false, message: { duplicate: en.duplicate, closed: en.closed, "not-registrable": en.notFound }[res.status] };
    }
    return { ok: true, code: res.code, waitlist: res.status === "waitlist" };
  });
}

// ---------------------------------------------------------------- podcast

export async function joinPodcastAsStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guard(db, fd, "podcast");
    if (stop) return stop;
    const schema = z.object({
      name: v.name,
      email: v.email,
      phone: v.optionalPhone(intl),
      topics: v.codes(PODCAST_TOPICS, { min: 1 }),
      language: v.language,
      availability: v.optionalText(300),
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd, ["topics"]));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    const res = await joinPodcast(db, { ...r.data, portal: "student", registered_by: null }, await getBaseUrl());
    if (!res) return { ok: false, message: en.alreadyJoined };
    revalidatePath("/students/podcast");
    // the private link is also shown on screen to the person who just signed up
    return { ok: true, data: { link: `/students/podcast/manage?token=${res.token}` } };
  });
}

async function participantFromToken(db: Db, fd: FormData) {
  return podcastDb.getParticipantByToken(db, String(fd.get("token") ?? ""));
}

export async function askToPair(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const me = await participantFromToken(db, fd);
    if (!me) return { ok: false, message: t.podcast.invalid };
    const result = await requestPodcastPair(db, me.id, String(fd.get("target") ?? ""));
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
    const me = await participantFromToken(db, fd);
    if (!me) return { ok: false, message: t.podcast.invalid };
    const accept = fd.get("accept") === "yes";
    const result = await respondPodcastRequest(db, String(fd.get("request") ?? ""), me.id, accept);
    revalidatePath("/students/podcast/manage");
    if (result === "unavailable") return { ok: false, message: t.podcast.unavailable };
    return { ok: true, message: result === "paired" ? t.podcast.paired : t.podcast.declined };
  });
}

export async function leavePodcast(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
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
    const stop = await guard(db, fd, "signin");
    if (stop) return stop;
    const r = validate(z.object({ name: v.name, email: v.email, phone: v.optionalPhone(intl) }), formObject(fd));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    const student = await upsertStudent(db, r.data);
    const token = await createLoginToken(db, student.id);
    if (!token) return { ok: false, message: t.signIn.tooMany };
    const url = `${await getBaseUrl()}/students/auth?token=${token}`;
    const sent = await sendEmail(student.email, templates.studentSignIn({ name: student.name.split(" ")[0], url }));
    // without an email provider (local development only), show the link on screen
    if (sent === "logged" && process.env.NODE_ENV !== "production") return { ok: true, data: { devLink: url } };
    if (sent === "logged") return { ok: false, message: en.emailNotSetUp };
    if (sent !== "sent") return { ok: false, message: en.generic };
    return { ok: true, message: t.signIn.sent };
  });
}

export async function completeSignIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await withDb("en", async (db) => {
    const session = await exchangeLoginToken(db, String(fd.get("token") ?? ""));
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
  if (res?.ok) redirect("/students/digital/mine");
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
  redirect("/students/digital");
}

// ---------------------------------------------------------------- digital support

export async function takeRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await withDb("en", async (db) => {
    const student = await currentStudent(db);
    if (!student) return { ok: false, message: t.digital.signInToTake };
    const result = await claimDigital(db, String(fd.get("request") ?? ""), student.id, await getBaseUrl());
    if (result === "unavailable") return { ok: false, message: t.digital.alreadyTaken };
    revalidatePath("/students/digital");
    return { ok: true, message: result };
  });
  // the card leaves the open list, so show the result on "My requests"
  if (res?.ok) redirect(`/students/digital/mine?taken=${res.message}`);
  return res;
}

async function withStudent(fd: FormData, fn: (db: Db, studentId: string, requestId: string) => Promise<ActionState>) {
  return withDb("en", async (db) => {
    const student = await currentStudent(db);
    if (!student) return { ok: false, message: t.digital.signInToTake };
    const res = await fn(db, student.id, String(fd.get("request") ?? ""));
    revalidatePath("/students/digital/mine");
    return res;
  });
}

export async function releaseRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  return withStudent(fd, async (db, studentId, requestId) =>
    (await digitalDb.releaseDigitalRequest(db, requestId, studentId))
      ? { ok: true, message: t.mine.released }
      : { ok: false, message: en.generic },
  );
}

export async function markRequestDone(_: ActionState, fd: FormData): Promise<ActionState> {
  return withStudent(fd, async (db, studentId, requestId) =>
    (await digitalDb.completeDigitalRequest(db, requestId, studentId))
      ? { ok: true, message: t.mine.markedDone }
      : { ok: false, message: en.generic },
  );
}

export async function acceptCodeOfConduct(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const student = await currentStudent(db);
    if (!student) return { ok: false, message: t.digital.signInToTake };
    if (fd.get("accept") !== "on") return { ok: false, errors: { accept: en.consent } };
    await acceptConduct(db, student.id);
    revalidatePath("/students/digital/mine");
    return { ok: true };
  });
}

// ---------------------------------------------------------------- lessons and visits

export async function offerLessons(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guard(db, fd, "lessons");
    if (stop) return stop;
    const topics = (await listLessonTopics(db)).map((x) => ({ code: x.id }));
    const schema = z
      .object({
        name: v.name,
        email: v.email,
        phone: v.optionalPhone(intl),
        topics: v.codes(topics),
        other_topic: v.optionalText(200),
        notes: v.optionalText(500),
        consent: v.consent,
      })
      .refine((d) => d.topics.length > 0 || d.other_topic, { message: "choose", path: ["topics"] });
    const r = validate(schema, formObject(fd, ["topics"]));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await createLesson(db, {
      role: "teach",
      portal: "student",
      name: r.data.name,
      email: r.data.email,
      phone: r.data.phone,
      topics: r.data.topics,
      other_topic: r.data.other_topic,
      notes: r.data.notes,
      registered_by: null,
    });
    return { ok: true, message: t.lessons.thanks };
  });
}

export async function requestVisit(_: ActionState, fd: FormData): Promise<ActionState> {
  return withDb("en", async (db) => {
    const stop = await guard(db, fd, "visit");
    if (stop) return stop;
    const schema = z.object({
      name: v.name,
      organization: v.optionalText(200),
      email: v.email,
      phone: v.optionalPhone(intl),
      preferred_dates: v.optionalText(200),
      group_size: z
        .string()
        .optional()
        .transform((s) => (s ? Number(s) : null))
        .refine((n) => n === null || (Number.isInteger(n) && n >= 1 && n <= 200), "choose"),
      notes: v.optionalText(1000),
      consent: v.consent,
    });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await createVisitRequest(db, r.data);
    return { ok: true, message: t.visit.thanks };
  });
}
