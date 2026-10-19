"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LANGUAGES } from "@/config/languages";
import { DAYS, DIGITAL_NEEDS, MEMORIAL_ROLES, PODCAST_TOPICS, PROJECTS } from "@/config/options";
import {
  adminEmails,
  DEV_ADMIN_COOKIE,
  devLoginAllowed,
  getAdmin,
  isAdminEmail,
  supabaseAuthConfigured,
  supabaseServer,
} from "@/lib/auth/admin";
import { eventForm, getEvent } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import * as digitalDb from "@/lib/db/digital";
import * as leaders from "@/lib/db/leaders";
import { isConnectionProblem } from "@/lib/db/errors";
import * as misc from "@/lib/db/misc";
import { adminEmailReason } from "@/lib/setup-status";
import * as podcastDb from "@/lib/db/podcast";
import type { Db } from "@/lib/db/types";
import {
  adminAssignDigital,
  adminPairPodcast,
  approveDigital,
  createDigital,
  createLecture,
  createLesson,
  joinPodcast,
  matchLessons,
  notifyEventCancelled,
  registerEvent,
} from "@/lib/domain";
import type { ActionState } from "@/lib/form";
import { allowed, getBaseUrl, localizeErrors, withDb } from "@/lib/server";
import { formObject, v, validate } from "@/lib/validation";

// Every admin action checks the signed-in admin itself: server actions are public endpoints.

async function asAdmin(fn: (db: Db, admin: { email: string }) => Promise<ActionState>): Promise<ActionState> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, message: "Please sign in again." };
  const res = await withDb("en", (db) => fn(db, admin));
  revalidatePath("/admin", "layout");
  return res;
}

const id = (fd: FormData, name = "id") => String(fd.get(name) ?? "");
const done = (message = "Saved."): ActionState => ({ ok: true, message });

// ---------------------------------------------------------------- sign in / out

const SETUP_HINT = "Open the setup check (link below) to see what's missing.";

export async function sendAdminLink(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!supabaseAuthConfigured()) {
    return { ok: false, message: `Admin sign-in isn't configured on this deployment. ${SETUP_HINT}` };
  }
  if (adminEmails().length === 0) {
    return { ok: false, message: `No admin emails are set up (ADMIN_EMAILS is empty). ${SETUP_HINT}` };
  }
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const generic: ActionState = {
    ok: true,
    message: "If this email is on the admin list, a sign-in link is on its way. Check your spam folder too.",
  };
  // Rate limiting uses the database. If the database can't be reached at all, still let admins
  // sign in (Supabase also rate-limits sign-in emails); any other error stops here.
  try {
    if (!(await allowed(await getDb(), "admin:login", 5, 900))) {
      return { ok: false, message: "Too many attempts. Try again in 15 minutes." };
    }
  } catch (err) {
    if (!isConnectionProblem(err)) {
      console.error("[admin] sign-in failed:", err);
      return { ok: false, message: `Something went wrong. ${SETUP_HINT}` };
    }
    console.error("[admin] sign-in rate limit skipped, the database can't be reached:", err);
  }
  // Same answer, in about the same time, whether or not the email is an admin and whether or
  // not Supabase sent it, so the page can't be used to find admin addresses.
  const started = Date.now();
  if (isAdminEmail(email)) {
    const { error } = await (await supabaseServer()).auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${await getBaseUrl()}/admin/auth/callback` },
    });
    if (error) console.error(`[admin] magic link failed: ${error.message}. ${adminEmailReason(error.message)}`);
  }
  await new Promise((r) => setTimeout(r, Math.max(0, 900 + Math.random() * 300 - (Date.now() - started))));
  return generic;
}

export async function devAdminLogin(): Promise<void> {
  if (!devLoginAllowed()) return;
  (await cookies()).set(DEV_ADMIN_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  if (supabaseAuthConfigured()) await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(DEV_ADMIN_COOKIE);
  redirect("/admin/login");
}

// ---------------------------------------------------------------- events

export async function sendCancellationNotice(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => done(`Notice sent to ${await notifyEventCancelled(db, id(fd, "key"))} people.`));
}

// ---------------------------------------------------------------- digital support

export async function assignDigital(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const student = id(fd, "student") || null;
    const ok = await adminAssignDigital(db, id(fd), student, await getBaseUrl());
    return ok ? done(student ? "Assigned." : "Back to open.") : { ok: false, message: "Could not change this request." };
  });
}

export async function approveDigitalMatch(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await approveDigital(db, id(fd), await getBaseUrl());
    return done("Approved. Both sides were notified.");
  });
}

export async function setDigitalStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const status = fd.get("status") === "cancelled" ? "cancelled" : "done";
    await digitalDb.adminSetDigitalStatus(db, id(fd), status);
    return done();
  });
}

export async function toggleMatchApproval(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.setSetting(db, "require_match_approval", fd.get("value") === "on");
    return done();
  });
}

// ---------------------------------------------------------------- podcast

export async function pairPodcast(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const pair = await adminPairPodcast(db, id(fd, "a"), id(fd, "b"));
    return pair ? done("Paired. Both were notified.") : { ok: false, message: "One of them is no longer available." };
  });
}

export async function unpairPodcast(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await podcastDb.unpair(db, id(fd));
    return done("Unpaired.");
  });
}

// ---------------------------------------------------------------- lessons

export async function addLessonTopic(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const r = validate(z.object({ name_en: v.text(100), name_he: v.text(100) }), formObject(fd));
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await misc.addLessonTopic(db, r.data);
    return done("Topic added.");
  });
}

export async function toggleLessonTopic(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.toggleLessonTopic(db, id(fd));
    return done();
  });
}

export async function matchLesson(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const ok = await matchLessons(db, id(fd, "learner"), id(fd, "teacher"));
    return ok ? done("Matched. Both were notified.") : { ok: false, message: "This learner is already matched." };
  });
}

export async function unmatchLesson(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.unmatchLesson(db, id(fd));
    return done("Unmatched.");
  });
}

// ---------------------------------------------------------------- review lists

export async function setReviewStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const kind = fd.get("kind");
    if (kind !== "lecture" && kind !== "visit" && kind !== "lesson") return { ok: false, message: "Unknown list." };
    const ok = await misc.setReviewStatus(db, kind, id(fd), String(fd.get("status") ?? ""));
    return ok ? done() : { ok: false, message: "Unknown status." };
  });
}

export async function toggleCallback(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.toggleCallbackHandled(db, id(fd));
    return done();
  });
}

export async function markMessageSent(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.markMessageSent(db, id(fd));
    return done("Marked as sent.");
  });
}

// ---------------------------------------------------------------- content

export async function addAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const r = validate(
      z.object({ text_en: v.text(500), text_he: v.text(500), expires_on: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "text").transform((s) => s || null) }),
      formObject(fd),
    );
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await misc.addAnnouncement(db, r.data);
    return done("Announcement added.");
  });
}

export async function toggleAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.toggleAnnouncement(db, id(fd));
    return done();
  });
}

export async function deleteAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.deleteAnnouncement(db, id(fd));
    return done("Deleted.");
  });
}

export async function addCourse(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const r = validate(
      z.object({ title_en: v.text(200), title_he: v.text(200), description_en: v.optionalText(1000), description_he: v.optionalText(1000) }),
      formObject(fd),
    );
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await misc.addCourse(db, r.data);
    return done("Course added.");
  });
}

export async function deleteCourse(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.deleteCourse(db, id(fd));
    return done("Deleted.");
  });
}

const time = z.string().regex(/^\d\d:\d\d$/, "text");

export async function addSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const r = validate(
      z.object({
        day: v.int(0, 6),
        start_time: time,
        end_time: z.string().regex(/^(\d\d:\d\d)?$/, "text").transform((s) => s || null),
        title_en: v.text(200),
        title_he: v.text(200),
        location_en: v.optionalText(200),
        location_he: v.optionalText(200),
      }),
      formObject(fd),
    );
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await misc.addSlot(db, r.data);
    return done("Added to the timetable.");
  });
}

export async function deleteSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await misc.deleteSlot(db, id(fd));
    return done("Deleted.");
  });
}

// ---------------------------------------------------------------- leaders and tasks

const project = v.choice(PROJECTS.map((p) => p.code));

export async function addLeader(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const r = validate(
      z.object({ name: v.name, phone: v.optionalPhone({ international: true }), email: v.optionalEmail, project }),
      formObject(fd),
    );
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await leaders.addLeader(db, r.data);
    return done("Leader added.");
  });
}

export async function deleteLeader(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await leaders.deleteLeader(db, id(fd));
    return done("Deleted.");
  });
}

export async function addTask(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const r = validate(
      z.object({
        title: v.text(300),
        project,
        leader_id: z.string().transform((s) => s || null),
        due_on: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "text").transform((s) => s || null),
      }),
      formObject(fd),
    );
    if (!r.ok) return { ok: false, errors: localizeErrors(r.errors, "en") };
    await leaders.addTask(db, r.data);
    return done("Task added.");
  });
}

export async function setTaskStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    const status = String(fd.get("status"));
    if (status !== "todo" && status !== "doing" && status !== "done") return { ok: false, message: "Unknown status." };
    await leaders.setTaskStatus(db, id(fd), status);
    return done();
  });
}

export async function deleteTask(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db) => {
    await leaders.deleteTask(db, id(fd));
    return done("Deleted.");
  });
}

// ---------------------------------------------------------------- register a resident on their behalf

export async function registerOnBehalf(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const type = String(fd.get("type"));
    const staff = String(fd.get("staff") ?? "").trim() || admin.email;
    const registered_by = `staff: ${staff}`.slice(0, 200);
    const contact = { name: v.name, phone: v.phone(), email: v.optionalEmail };
    const base = await getBaseUrl();
    const fail = (errors: Parameters<typeof localizeErrors>[0]): ActionState => ({ ok: false, errors: localizeErrors(errors, "en") });

    if (type === "event") {
      const event = await getEvent(String(fd.get("event") ?? ""));
      if (!event || !eventForm(event)) return { ok: false, errors: { event: "Please choose an event." } };
      const r = validate(
        z.object({
          ...contact,
          attendees: v.int(1, 10),
          languages: v.codes(LANGUAGES),
          other_language: v.optionalText(60),
          preferred_language: v.optionalLanguage,
          role: z.string().optional().transform((s) => (s && MEMORIAL_ROLES.resident.some((x) => x.code === s) ? s : null)),
          notes: v.optionalText(500),
        }),
        formObject(fd, ["languages"]),
      );
      if (!r.ok) return fail(r.errors);
      const res = await registerEvent(db, event, { ...r.data, portal: "resident", registered_by }, base, { ignoreDeadline: true });
      if (!("code" in res)) return { ok: false, message: `Not registered: ${res.status}.` };
      return { ok: true, message: `Registered (${res.status}). Request code: ${res.code}`, code: res.code };
    }

    if (type === "digital") {
      const r = validate(
        z.object({
          ...contact,
          needs: v.codes(DIGITAL_NEEDS, { min: 1 }),
          needs_other: v.optionalText(300),
          days: v.codes(DAYS),
          hours: v.timeChoice,
          language: v.language,
        }),
        formObject(fd, ["needs", "days"]),
      );
      if (!r.ok) return fail(r.errors);
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
          registered_by,
        },
        base,
      );
      return { ok: true, message: `Request saved. Request code: ${res.code}`, code: res.code };
    }

    if (type === "podcast") {
      const r = validate(
        z.object({ ...contact, topics: v.codes(PODCAST_TOPICS, { min: 1 }), language: v.language, availability: v.optionalText(300) }),
        formObject(fd, ["topics"]),
      );
      if (!r.ok) return fail(r.errors);
      const res = await joinPodcast(db, { ...r.data, portal: "resident", registered_by }, base);
      if (!res) return { ok: false, message: "This phone or email is already signed up for the podcast." };
      return { ok: true, message: `Signed up. Request code: ${res.code}`, code: res.code };
    }

    if (type === "lesson") {
      const topics = (await misc.listLessonTopics(db)).map((x) => ({ code: x.id }));
      const r = validate(
        z.object({ ...contact, topics: v.codes(topics), other_topic: v.optionalText(200), notes: v.optionalText(500) }),
        formObject(fd, ["topics"]),
      );
      if (!r.ok) return fail(r.errors);
      const res = await createLesson(db, { ...r.data, role: "learn", portal: "resident", registered_by });
      return { ok: true, message: `Saved. Request code: ${res.code}`, code: res.code };
    }

    if (type === "lecture") {
      const r = validate(
        z.object({ ...contact, topic: v.text(200), language: v.language, preferred_date: v.optionalText(100), description: v.optionalText(1000) }),
        formObject(fd),
      );
      if (!r.ok) return fail(r.errors);
      const res = await createLecture(db, { ...r.data, registered_by });
      return { ok: true, message: `Saved. Request code: ${res.code}`, code: res.code };
    }

    if (type === "callback") {
      const r = validate(z.object({ name: v.name, phone: v.phone() }), formObject(fd));
      if (!r.ok) return fail(r.errors);
      await misc.createCallback(db, { ...r.data, registered_by });
      return done("Callback request saved.");
    }

    return { ok: false, message: "Choose what to register." };
  });
}
