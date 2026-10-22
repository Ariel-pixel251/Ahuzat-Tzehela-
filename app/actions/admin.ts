"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LANGUAGES } from "@/config/languages";
import { DIGITAL_NEEDS, PODCAST_TOPICS, PROJECTS } from "@/config/options";
import { addStudentByAdmin, revokeStudent } from "@/lib/db/students";
import { adminEmails, DEV_ADMIN_COOKIE, devLoginAllowed, getAdmin, isAdminEmail, supabaseAuthConfigured, supabaseServer } from "@/lib/auth/admin";
import { eventForm, getEvent } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import { isConnectionProblem } from "@/lib/db/errors";
import * as leaders from "@/lib/db/leaders";
import * as misc from "@/lib/db/misc";
import * as podcastDb from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import type { Db } from "@/lib/db/types";
import {
  adminAddVolunteer,
  adminPairPodcast,
  approveVolunteer,
  blockDateAndCancel,
  bookDigital,
  cancelSlotAndNotify,
  joinPodcast,
  notifyEventCancelled,
  registerEvent,
  updateSlotAndNotify,
} from "@/lib/domain";
import type { ActionState } from "@/lib/form";
import { logError } from "@/lib/log";
import { allowed, getBaseUrl, localizeErrors, withDb } from "@/lib/server";
import { adminEmailReason } from "@/lib/setup-status";
import { form, formObject, v, validate, type FieldErrors } from "@/lib/validation";

// Every admin action checks the signed-in admin itself (server actions are public endpoints),
// validates its input, and records the change in the audit log.

type Admin = { email: string };

async function asAdmin(fn: (db: Db, admin: Admin) => Promise<ActionState>): Promise<ActionState> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, message: "Please sign in again." };
  const res = await withDb("en", (db) => fn(db, admin));
  revalidatePath("/admin", "layout");
  return res;
}

const done = (message = "Saved."): ActionState => ({ ok: true, message });
const fail = (errors: FieldErrors): ActionState => {
  const localized = localizeErrors(errors, "en");
  return { ok: false, errors: localized, message: localized._ ?? "Please check the highlighted fields." };
};
/** The id field of a one-button form, as a UUID. */
const idOf = (fd: FormData, name = "id") => {
  const r = v.uuid.safeParse(fd.get(name));
  return r.success ? r.data : null;
};
const badId: ActionState = { ok: false, message: "Not found." };

// ---------------------------------------------------------------- sign in / out

const SETUP_HINT = "Open the setup check (link below) to see what's missing.";

export async function sendAdminLink(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!supabaseAuthConfigured()) {
    return { ok: false, message: `Admin sign-in isn't configured on this deployment. ${SETUP_HINT}` };
  }
  if (adminEmails().length === 0) {
    return { ok: false, message: `No admin emails are set up (ADMIN_EMAILS is empty). ${SETUP_HINT}` };
  }
  const parsed = v.email.safeParse(fd.get("email") ?? "");
  const email = parsed.success ? parsed.data : "";
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
      logError("admin sign-in", err);
      return { ok: false, message: `Something went wrong. ${SETUP_HINT}` };
    }
    logError("admin sign-in rate limit skipped, the database can't be reached", err);
  }
  // Same answer, in about the same time, whether or not the email is an admin and whether or
  // not Supabase sent it, so the page can't be used to find admin addresses.
  const started = Date.now();
  if (email && isAdminEmail(email)) {
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
  return asAdmin(async (db, admin) => {
    const key = v.eventKey.safeParse(fd.get("key"));
    if (!key.success) return badId;
    const n = await notifyEventCancelled(db, key.data);
    await misc.audit(db, admin.email, "event.cancel_notice", key.data, { notified: n });
    return done(`Notice sent to ${n} people.`);
  });
}

// ---------------------------------------------------------------- podcast times

export async function createPodcastTimeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const schema = form({
      time_date: v.date,
      start_time: v.time,
      end_time: v.time,
      place_he: v.text(200),
      place_en: v.optionalText(200),
      pairs: v.int(1, 50),
      repeat: v.checkbox,
      until: v.optionalDate,
    })
      .refine(endAfterStart, { message: "text", path: ["end_time"] })
      .refine((d) => !d.repeat || (d.until !== null && d.until >= d.time_date), { message: "text", path: ["until"] })
      // at most a year of weekly times in one go
      .refine((d) => !d.repeat || !d.until || Date.parse(d.until) - Date.parse(d.time_date) <= 366 * 86_400_000, { message: "text", path: ["until"] });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return fail(r.errors);
    const { repeat, until, ...input } = r.data;
    const created = await podcastDb.createPodcastTimes(db, input, repeat ? until : null);
    await misc.audit(db, admin.email, "podcast_time.create", null, { created, from: input.time_date, until: repeat ? until : null });
    return done(created === 1 ? "Podcast time created." : `Created ${created} weekly podcast times.`);
  });
}

export async function setPodcastTimeOpenAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    const open = fd.get("open") === "yes";
    await podcastDb.setPodcastTimeOpen(db, id, open);
    await misc.audit(db, admin.email, open ? "podcast_time.open" : "podcast_time.close", id);
    return done(open ? "Open: people can choose it." : "Closed: nobody new can choose it.");
  });
}

export async function deletePodcastTimeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    await podcastDb.deletePodcastTime(db, id);
    await misc.audit(db, admin.email, "podcast_time.delete", id);
    return done("Deleted. Anyone who chose it is still signed up, without a time.");
  });
}

// ---------------------------------------------------------------- digital support slots

const slotFields = {
  slot_date: v.date,
  start_time: v.time,
  end_time: v.time,
  place_he: v.text(200),
  place_en: v.optionalText(200),
  resident_places: v.int(1, 50),
  helpers_needed: v.int(0, 20),
  note_en: v.optionalText(500),
  note_he: v.optionalText(500),
  booking_open: v.checkbox,
  closes_hours_before: v.optionalInt(0, 336),
};

function slotInput(d: z.output<z.ZodObject<typeof slotFields>>): slots.SlotInput {
  return { ...d };
}

const endAfterStart = (d: { start_time: string; end_time: string }) => d.end_time > d.start_time;

export async function createSlotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const schema = form({ ...slotFields, repeat: v.checkbox, until: v.optionalDate })
      .refine(endAfterStart, { message: "text", path: ["end_time"] })
      .refine((d) => !d.repeat || (d.until !== null && d.until >= d.slot_date), { message: "text", path: ["until"] });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return fail(r.errors);
    const { repeat, until, ...rest } = r.data;
    const input = slotInput(rest);
    if (repeat && until) {
      const { seriesId, created } = await slots.createSeries(db, input, until, admin.email);
      await misc.audit(db, admin.email, "slot.create_series", seriesId, { created, from: input.slot_date, until });
      return done(`Created ${created} weekly slots.`);
    }
    if ((await slots.listBlockedDates(db)).some((b) => b.day === input.slot_date)) {
      return { ok: false, message: "That date is blocked (holiday). Remove it from the blocked dates first." };
    }
    const id = await slots.createSlot(db, input);
    await misc.audit(db, admin.email, "slot.create", id);
    return done("Slot created.");
  });
}

export async function updateSlotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const schema = form({ id: v.uuid, ...slotFields }).refine(endAfterStart, { message: "text", path: ["end_time"] });
    const r = validate(schema, formObject(fd));
    if (!r.ok) return fail(r.errors);
    const { id, ...rest } = r.data;
    const notified = await updateSlotAndNotify(db, id, slotInput(rest));
    if (notified === null) return { ok: false, message: "This slot can't be changed (cancelled or gone)." };
    await misc.audit(db, admin.email, "slot.update", id, { notified });
    return done(notified ? `Saved. ${notified} people were told about the change.` : "Saved.");
  });
}

export async function setSlotOpen(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    const open = fd.get("open") === "yes";
    await slots.setBookingOpen(db, id, open);
    await misc.audit(db, admin.email, open ? "slot.open" : "slot.close", id);
    return done(open ? "Open for booking." : "Closed for booking.");
  });
}

export async function cancelSlotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    const notified = await cancelSlotAndNotify(db, id);
    if (notified === null) return { ok: false, message: "Already cancelled." };
    await misc.audit(db, admin.email, "slot.cancel", id, { notified });
    return done(`Cancelled. ${notified} people were told.`);
  });
}

export async function cancelSeriesRest(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ series: v.uuid, from: v.date }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    let cancelled = 0;
    let notified = 0;
    for (const { id } of await slots.listSeriesSlotIds(db, r.data.series, r.data.from)) {
      const n = await cancelSlotAndNotify(db, id);
      if (n !== null) {
        cancelled++;
        notified += n;
      }
    }
    await misc.audit(db, admin.email, "slot.cancel_series", r.data.series, { from: r.data.from, cancelled, notified });
    return done(`Cancelled ${cancelled} slots. ${notified} people were told.`);
  });
}

export async function blockDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ day: v.date, reason: v.optionalText(200) }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    const res = await blockDateAndCancel(db, r.data.day, r.data.reason);
    await misc.audit(db, admin.email, "slot.block_date", r.data.day, res);
    return done(res.cancelled ? `Date blocked. ${res.cancelled} slots cancelled, ${res.notified} people told.` : "Date blocked.");
  });
}

export async function unblockDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const day = v.date.safeParse(fd.get("day"));
    if (!day.success) return badId;
    await slots.removeBlockedDate(db, day.data);
    await misc.audit(db, admin.email, "slot.unblock_date", day.data);
    return done("Date unblocked (cancelled slots stay cancelled).");
  });
}

export async function moveBookingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ id: v.uuid, slot: v.uuid }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    const res = await slots.moveBooking(db, r.data.id, r.data.slot);
    await misc.audit(db, admin.email, "booking.move", r.data.id, { to: r.data.slot, result: res });
    const messages = { moved: "Moved.", full: "That slot is full.", duplicate: "Already booked into that slot.", not_found: "Can't move there." };
    return { ok: res === "moved", message: messages[res] };
  });
}

export async function cancelBookingAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    const ok = await slots.cancelBooking(db, id);
    await misc.audit(db, admin.email, "booking.cancel", id);
    return ok ? done("Booking cancelled.") : { ok: false, message: "Already cancelled." };
  });
}

export async function addVolunteerAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(
      form({
        slot: v.uuid,
        student: v.uuidOrNew,
        new_name: v.optionalText(100),
        new_email: v.optionalEmail,
        new_phone: v.optionalPhone({ international: true }),
        notify: v.checkbox,
      }),
      formObject(fd),
    );
    if (!r.ok) return fail(r.errors);
    let studentId = r.data.student;
    if (studentId === "new") {
      // a student who hasn't signed up: the admin types their name (email and phone optional)
      const name = v.name.safeParse(r.data.new_name ?? "");
      if (!name.success) return { ok: false, errors: { new_name: "Please enter the student's name." } };
      if (await misc.isBlocked(db, r.data.new_phone, r.data.new_email)) return { ok: false, message: "This person is blocked." };
      studentId = await addStudentByAdmin(db, { name: name.data, email: r.data.new_email, phone: r.data.new_phone, added_by: admin.email });
    }
    const res = await adminAddVolunteer(db, r.data.slot, studentId, { notify: r.data.notify, baseUrl: await getBaseUrl() });
    await misc.audit(db, admin.email, "volunteer.add", r.data.slot, { student: studentId, result: res, notified: r.data.notify });
    const messages = { confirmed: "Added.", pending: "Added.", full: "No helper places left.", duplicate: "Already in this slot.", closed: "This slot has started.", not_found: "Slot not found." };
    const ok = res === "confirmed" || res === "pending";
    return { ok, message: ok && r.data.notify ? "Added, and a message was sent (if they have an email)." : messages[res] };
  });
}

export async function moveVolunteerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ id: v.uuid, slot: v.uuid }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    const res = await slots.moveVolunteer(db, r.data.id, r.data.slot);
    await misc.audit(db, admin.email, "volunteer.move", r.data.id, { to: r.data.slot, result: res });
    const messages = { moved: "Moved.", full: "That slot has enough helpers.", duplicate: "Already in that slot.", not_found: "Can't move there." };
    return { ok: res === "moved", message: messages[res] };
  });
}

export async function removeVolunteerAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    const ok = await slots.adminCancelVolunteer(db, id);
    await misc.audit(db, admin.email, "volunteer.remove", id);
    return ok ? done("Removed.") : { ok: false, message: "Already removed." };
  });
}

export async function approveVolunteerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    const ok = await approveVolunteer(db, id, await getBaseUrl());
    await misc.audit(db, admin.email, "volunteer.approve", id);
    return ok ? done("Approved. The student was told.") : { ok: false, message: "Nothing to approve." };
  });
}

export async function saveDigitalSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ approval: v.checkbox, cutoff: v.int(0, 168) }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    await misc.setSetting(db, "require_helper_approval", r.data.approval);
    await misc.setSetting(db, "student_cancel_cutoff_hours", r.data.cutoff);
    await misc.audit(db, admin.email, "settings.digital", null, r.data);
    return done();
  });
}

// ---------------------------------------------------------------- podcast

const personFields = (p: "a" | "b") => ({
  [`${p}_name`]: v.optionalText(100),
  [`${p}_email`]: v.optionalEmail,
  [`${p}_phone`]: v.optionalPhone({ international: true }),
  [`${p}_portal`]: z.enum(["student", "resident"]).optional(),
});

export async function pairPodcast(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(
      form({
        a: v.uuidOrNew,
        b: v.uuidOrNew,
        ...personFields("a"),
        ...personFields("b"),
        meeting_date: v.optionalDate,
        meeting_time: v.optionalTime,
        meeting_place: v.optionalText(200),
        notify: v.checkbox,
      }),
      formObject(fd),
    );
    if (!r.ok) return fail(r.errors);
    const d = r.data as Record<string, unknown> & { a: string; b: string; notify: boolean };

    // a person typed in on the form: added to the podcast list (no sign-up needed)
    const resolve = async (p: "a" | "b"): Promise<string | ActionState> => {
      if (d[p] !== "new") return d[p];
      const name = v.name.safeParse(d[`${p}_name`] ?? "");
      if (!name.success) return { ok: false, errors: { [`${p}_name`]: "Please enter a name." } };
      const portal = (d[`${p}_portal`] as "student" | "resident" | undefined) ?? "resident";
      const email = (d[`${p}_email`] as string | null) ?? null;
      const phone = (d[`${p}_phone`] as string | null) ?? null;
      if (await misc.isBlocked(db, phone, email)) return { ok: false, message: "This person is blocked." };
      const res = await podcastDb.joinPodcast(db, {
        name: name.data,
        email,
        phone,
        portal,
        topics: [],
        language: portal === "student" ? "en" : "he",
        availability: null,
        registered_by: `staff: ${admin.email}`.slice(0, 200),
      });
      if (!res) return { ok: false, message: `${name.data}: this email or phone is already on the podcast list. Choose them from the list instead.` };
      return res.id;
    };
    const a = await resolve("a");
    if (typeof a !== "string") return a;
    const b = await resolve("b");
    if (typeof b !== "string") return b;

    const meeting = d.meeting_date
      ? { date: d.meeting_date as string, time: (d.meeting_time as string | null) ?? null, place: (d.meeting_place as string | null) ?? null }
      : null;
    const pair = await adminPairPodcast(db, a, b, { meeting, notify: d.notify });
    await misc.audit(db, admin.email, "podcast.pair", pair, { a, b, meeting: Boolean(meeting), notified: d.notify });
    if (!pair) return { ok: false, message: "One of them is no longer available (already paired or left)." };
    return done(d.notify ? "Paired. Both were sent a message with their partner and the meeting time." : "Paired (no message sent).");
  });
}

export async function unpairPodcast(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    await podcastDb.unpair(db, id);
    await misc.audit(db, admin.email, "podcast.unpair", id);
    return done("Unpaired.");
  });
}

// ---------------------------------------------------------------- the manual message queue

export async function markMessageSent(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    await misc.markMessageSent(db, id);
    await misc.audit(db, admin.email, "message.sent", id);
    return done("Marked as sent.");
  });
}

// ---------------------------------------------------------------- problem reports, blocking, deleting a person

export async function markReportHandled(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    await misc.markReportHandled(db, id);
    await misc.audit(db, admin.email, "report.handled", id);
    return done("Marked as handled.");
  });
}

export async function blockContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ phone: v.optionalPhone({ international: true }), email: v.optionalEmail, reason: v.optionalText(300) }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    if (!r.data.phone && !r.data.email) return { ok: false, message: "Enter a phone number or an email." };
    if (r.data.phone) await misc.blockContact(db, { kind: "phone", value: r.data.phone, reason: r.data.reason, blocked_by: admin.email });
    if (r.data.email) await misc.blockContact(db, { kind: "email", value: r.data.email, reason: r.data.reason, blocked_by: admin.email });
    // takes effect at once: signed out everywhere, places in slots cancelled
    await revokeStudent(db, { email: r.data.email, phone: r.data.phone });
    // the audit log never holds the person's phone or email
    await misc.audit(db, admin.email, "person.block", null, { phone: Boolean(r.data.phone), email: Boolean(r.data.email) });
    return done("Blocked. They can't sign up or volunteer any more.");
  });
}

export async function unblockContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    await misc.unblockContact(db, id);
    await misc.audit(db, admin.email, "person.unblock", id);
    return done("Unblocked.");
  });
}

export async function deletePersonAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(
      form({ phone: v.optionalPhone({ international: true }), email: v.optionalEmail, confirm: v.consent }),
      formObject(fd),
    );
    if (!r.ok) return fail(r.errors);
    if (!r.data.phone && !r.data.email) return { ok: false, message: "Enter a phone number or an email." };
    const counts = await misc.deletePersonData(db, r.data.phone, r.data.email);
    const total = Object.values(counts).reduce((n, c) => n + c, 0);
    await misc.audit(db, admin.email, "person.delete_all_data", null, counts);
    return done(`Deleted ${total} records: ${Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(", ") || "nothing was found"}.`);
  });
}

// ---------------------------------------------------------------- leaders and tasks

const project = v.choice(PROJECTS.map((p) => p.code));

export async function addLeader(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ name: v.name, phone: v.optionalPhone({ international: true }), email: v.optionalEmail, project }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    await leaders.addLeader(db, r.data);
    await misc.audit(db, admin.email, "leader.add", null, { project: r.data.project });
    return done("Leader added.");
  });
}

export async function deleteLeader(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    await leaders.deleteLeader(db, id);
    await misc.audit(db, admin.email, "leader.delete", id);
    return done("Deleted.");
  });
}

export async function addTask(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ title: v.text(300), project, leader_id: v.optionalUuid, due_on: v.optionalDate }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    await leaders.addTask(db, r.data);
    await misc.audit(db, admin.email, "task.add", null, { project: r.data.project });
    return done("Task added.");
  });
}

export async function setTaskStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const r = validate(form({ id: v.uuid, status: v.choice(["todo", "doing", "done"] as const) }), formObject(fd));
    if (!r.ok) return fail(r.errors);
    await leaders.setTaskStatus(db, r.data.id, r.data.status);
    await misc.audit(db, admin.email, "task.status", r.data.id, { status: r.data.status });
    return done();
  });
}

export async function deleteTask(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const id = idOf(fd);
    if (!id) return badId;
    await leaders.deleteTask(db, id);
    await misc.audit(db, admin.email, "task.delete", id);
    return done("Deleted.");
  });
}

// ---------------------------------------------------------------- register a resident on their behalf

export async function registerOnBehalf(_: ActionState, fd: FormData): Promise<ActionState> {
  return asAdmin(async (db, admin) => {
    const type = String(fd.get("type"));
    const common = { type: z.string(), staff: v.optionalText(100), name: v.name, phone: v.phone() };
    const staffOf = (s: string | null) => `staff: ${s || admin.email}`.slice(0, 200);
    const base = await getBaseUrl();

    if (type === "event") {
      const key = v.eventKey.safeParse(fd.get("event"));
      const event = key.success ? await getEvent(key.data) : null;
      if (!event || !eventForm(event)) return { ok: false, errors: { event: "Please choose an event." } };
      const r = validate(
        form({
          ...common,
          email: v.optionalEmail,
          event: v.eventKey,
          attendees: v.int(1, 10),
          languages: v.codes(LANGUAGES),
          other_language: v.optionalText(60),
          preferred_language: v.optionalLanguage,
          notes: v.optionalText(500, { multiline: true }),
        }),
        formObject(fd, ["languages"]),
      );
      if (!r.ok) return fail(r.errors);
      const d = r.data;
      const person = {
        name: d.name,
        phone: d.phone,
        email: d.email,
        attendees: d.attendees,
        languages: d.languages,
        other_language: d.other_language,
        preferred_language: d.preferred_language,
        notes: d.notes,
      };
      const res = await registerEvent(db, event, { ...person, portal: "resident", registered_by: staffOf(d.staff) }, base, { ignoreDeadline: true });
      if (!("code" in res)) return { ok: false, message: `Not registered: ${res.status}.` };
      await misc.audit(db, admin.email, "on_behalf.event", event.key, { status: res.status });
      return { ok: true, message: `Registered (${res.status}). Request code: ${res.code}`, code: res.code };
    }

    if (type === "digital") {
      const r = validate(
        form({ ...common, email: v.optionalEmail, slot: v.uuid, needs: v.codes(DIGITAL_NEEDS, { min: 1 }), needs_other: v.optionalText(300) }),
        formObject(fd, ["needs"]),
      );
      if (!r.ok) return fail(r.errors);
      const res = await bookDigital(
        db,
        r.data.slot,
        { name: r.data.name, phone: r.data.phone, email: r.data.email, needs: r.data.needs, needs_other: r.data.needs_other, registered_by: staffOf(r.data.staff) },
        base,
        { staff: true },
      );
      await misc.audit(db, admin.email, "on_behalf.digital", r.data.slot, { status: res.status });
      if (res.status !== "booked") return { ok: false, message: `Not booked: ${res.status}.` };
      return { ok: true, message: `Booked. Request code: ${res.code}`, code: res.code };
    }

    if (type === "podcast") {
      const r = validate(
        form({ ...common, email: v.optionalEmail, topics: v.codes(PODCAST_TOPICS, { min: 1 }), language: v.language, time: v.podcastTime }),
        formObject(fd, ["topics"]),
      );
      if (!r.ok) return fail(r.errors);
      const d = r.data;
      const person = { name: d.name, phone: d.phone, email: d.email, topics: d.topics, language: d.language, availability: null, time_id: d.time };
      const res = await joinPodcast(db, { ...person, portal: "resident", registered_by: staffOf(d.staff) }, base, { staff: true });
      await misc.audit(db, admin.email, "on_behalf.podcast", null, { status: res === "blocked" ? res : res.status });
      if (res === "blocked") return { ok: false, message: "This person is blocked." };
      if (res.status === "duplicate") return { ok: false, message: "This phone or email is already signed up for the podcast." };
      if (res.status !== "joined") return { ok: false, message: "That podcast time is gone (deleted or already started). Choose another." };
      return { ok: true, message: `Signed up. Request code: ${res.code}`, code: res.code };
    }

    return { ok: false, message: "Choose what to register." };
  });
}
