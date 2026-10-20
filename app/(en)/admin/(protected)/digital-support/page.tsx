import type { Metadata } from "next";
import {
  approveVolunteerAction,
  blockDateAction,
  cancelBookingAdmin,
  cancelSeriesRest,
  cancelSlotAction,
  moveBookingAction,
  moveVolunteerAction,
  removeVolunteerAdmin,
  saveDigitalSettings,
  setSlotOpen,
  unblockDateAction,
} from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { AddHelperForm } from "@/components/admin/GroupForms";
import { SlotForm } from "@/components/admin/SlotForm";
import { InlineForm } from "@/components/forms";
import { Badge, Notice, PageTitle } from "@/components/ui";
import { DIGITAL_NEEDS, optionLabel } from "@/config/options";
import { adminPage } from "@/lib/admin-page";
import { helperApprovalRequired, studentCancelCutoffHours } from "@/lib/domain";
import { freePlaces, listBlockedDates, listBookingsForAdmin, listSlotsForAdmin, listVolunteersForAdmin, type Slot } from "@/lib/db/slots";
import { listStudents } from "@/lib/db/students";
import { formatSlot } from "@/lib/i18n/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Digital support" };

/** Slots (create, edit, open/close, cancel), blocked dates, bookings and volunteers. */
export default async function AdminDigitalSupport() {
  const { db } = await adminPage("digital-support");
  const [slots, bookings, volunteers, blocked, students, approval, cutoff] = await Promise.all([
    listSlotsForAdmin(db),
    listBookingsForAdmin(db),
    listVolunteersForAdmin(db),
    listBlockedDates(db),
    listStudents(db),
    helperApprovalRequired(db),
    studentCancelCutoffHours(db),
  ]);
  const now = new Date();
  const upcoming = slots.filter((s) => s.ends_at > now);
  const past = slots.filter((s) => s.ends_at <= now);
  const movable = upcoming.filter((s) => s.status === "scheduled");
  const studentChoices = students.map((st) => ({ id: st.id, label: `${st.name}${st.email ? ` (${st.email})` : " (added by staff)"}` }));
  const slotSelect = (name: string, exclude: string, label: string) => (
    <>
      <label className="sr-only" htmlFor={`${name}-${exclude}`}>{label}</label>
      <select id={`${name}-${exclude}`} name={name} required className="min-h-10 rounded border-2 border-ink px-2">
        <option value="">Move to…</option>
        {movable.filter((s) => s.id !== exclude).map((s) => (
          <option key={s.id} value={s.id}>{formatSlot(s, "en")}</option>
        ))}
      </select>
    </>
  );

  const slotCard = (s: Slot) => {
    const slotBookings = bookings.filter((b) => b.slot_id === s.id);
    const slotVolunteers = volunteers.filter((v) => v.slot_id === s.id);
    const active = s.status === "scheduled" && s.ends_at > now;
    return (
      <li key={s.id} className="rounded-2xl border-2 border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-extrabold">{formatSlot(s, "en")}</h3>
          {s.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : s.booking_open ? <Badge tone="ok">Open</Badge> : <Badge tone="warn">Closed for booking</Badge>}
          <Badge tone={freePlaces(s) === 0 ? "warn" : "neutral"}>Residents {s.booked}/{s.resident_places}</Badge>
          <Badge tone={s.helpers < s.helpers_needed ? "warn" : "ok"}>Helpers {s.helpers}/{s.helpers_needed}</Badge>
          {s.series_id && <Badge>Weekly</Badge>}
        </div>
        <p className="mt-1 text-sm">
          {s.place_he}
          {s.closes_hours_before !== null ? ` · booking closes ${s.closes_hours_before}h before` : ""}
          {s.note_en ? ` · ${s.note_en}` : ""}
        </p>

        {active && (
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton action={setSlotOpen} fields={{ id: s.id, open: s.booking_open ? "no" : "yes" }} label={s.booking_open ? "Close for booking" : "Open for booking"} variant="small" />
            <ActionButton action={cancelSlotAction} fields={{ id: s.id }} label="Cancel this slot (notify everyone)" variant="small" />
            {s.series_id && (
              <ActionButton action={cancelSeriesRest} fields={{ series: s.series_id, from: s.slot_date }} label="Cancel this and later weeks" variant="small" />
            )}
          </div>
        )}

        {active && (
          <details className="mt-3">
            <summary className="cursor-pointer font-bold text-brand">Edit this slot</summary>
            <div className="mt-3">
              <SlotForm
                defaults={{
                  id: s.id,
                  slot_date: s.slot_date,
                  start_time: s.start_time,
                  end_time: s.end_time,
                  place_he: s.place_he,
                  place_en: s.place_en ?? "",
                  resident_places: String(s.resident_places),
                  helpers_needed: String(s.helpers_needed),
                  note_en: s.note_en ?? "",
                  note_he: s.note_he ?? "",
                  booking_open: s.booking_open,
                  closes_hours_before: s.closes_hours_before === null ? "" : String(s.closes_hours_before),
                }}
              />
            </div>
          </details>
        )}

        <h4 className="mt-4 font-bold">Residents</h4>
        <Table
          head={["Resident", "Needs", "Code / by", "Actions"]}
          empty="No bookings."
          rows={slotBookings.map((b) => [
            <div key="r">
              <p className="font-bold">{b.name}</p>
              <p dir="ltr" className="text-start">{formatPhone(b.phone)}</p>
              {b.email && <p>{b.email}</p>}
              {b.status === "cancelled" && <Badge tone="bad">cancelled</Badge>}
            </div>,
            <span key="n">{b.needs.map((n) => optionLabel(DIGITAL_NEEDS, n, "en")).join(", ")}{b.needs_other ? ` (${b.needs_other})` : ""}</span>,
            <span key="c">{b.code}{b.registered_by ? ` · ${b.registered_by}` : ""}</span>,
            b.status === "confirmed" && active ? (
              <div key="a" className="flex flex-col gap-2">
                <InlineForm action={moveBookingAction} submitLabel="Move">
                  <input type="hidden" name="id" value={b.id} />
                  {slotSelect("slot", s.id, "Move booking to slot")}
                </InlineForm>
                <ActionButton action={cancelBookingAdmin} fields={{ id: b.id }} label="Cancel booking" variant="small" />
              </div>
            ) : "",
          ])}
        />

        <h4 className="mt-4 font-bold">Student helpers</h4>
        <Table
          head={["Student", "Status", "Actions"]}
          empty="No helpers yet."
          rows={slotVolunteers.map((v) => [
            <div key="s">
              <p className="font-bold">{v.student_name}</p>
              <p>{v.student_email}</p>
              {v.student_phone && <p dir="ltr" className="text-start">{formatPhone(v.student_phone)}</p>}
            </div>,
            <Badge key="st" tone={v.status === "confirmed" ? "ok" : "warn"}>{v.status}</Badge>,
            active ? (
              <div key="a" className="flex flex-col gap-2">
                {v.status === "pending" && <ActionButton action={approveVolunteerAction} fields={{ id: v.id }} label="Approve" variant="small" />}
                <InlineForm action={moveVolunteerAction} submitLabel="Move">
                  <input type="hidden" name="id" value={v.id} />
                  {slotSelect("slot", s.id, "Move helper to slot")}
                </InlineForm>
                <ActionButton action={removeVolunteerAdmin} fields={{ id: v.id }} label="Remove" variant="small" />
              </div>
            ) : "",
          ])}
        />
        {active && (
          <details className="mt-3">
            <summary className="cursor-pointer font-bold text-brand">Add a helper</summary>
            <div className="mt-3">
              <AddHelperForm slotId={s.id} students={studentChoices} />
            </div>
          </details>
        )}
      </li>
    );
  };

  return (
    <>
      <PageTitle lead="Residents book these slots for help with phones and computers; students volunteer as helpers.">Digital support</PageTitle>

      <AdminSection title="Create slots">
        <SlotForm />
      </AdminSection>

      <AdminSection title="Upcoming slots" actions={<CsvLink dataset="digital" />}>
        {upcoming.length === 0 ? <Notice kind="warn">No upcoming slots. Create some above.</Notice> : <ul className="space-y-4">{upcoming.map(slotCard)}</ul>}
      </AdminSection>

      <AdminSection title="Blocked dates (holidays)">
        <InlineForm action={blockDateAction} submitLabel="Block date (cancels its slots)">
          <label className="flex items-center gap-2">
            <span className="text-sm font-bold">Date</span>
            <input type="date" name="day" required className="min-h-10 rounded border-2 border-ink px-2" />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm font-bold">Reason</span>
            <input name="reason" maxLength={200} className="min-h-10 rounded border-2 border-ink px-2" />
          </label>
        </InlineForm>
        <ul className="mt-3 space-y-2">
          {blocked.map((b) => (
            <li key={b.day} className="flex flex-wrap items-center gap-3">
              <span className="font-bold">{b.day}</span>
              {b.reason && <span>{b.reason}</span>}
              <ActionButton action={unblockDateAction} fields={{ day: b.day }} label="Unblock" variant="small" />
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection title="Settings">
        <InlineForm action={saveDigitalSettings} submitLabel="Save">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="approval" defaultChecked={approval} className="size-5" />
            A leader approves each student helper
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm font-bold">Students can cancel up to</span>
            <input type="number" name="cutoff" min={0} max={168} defaultValue={cutoff} required className="min-h-10 w-20 rounded border-2 border-ink px-2" />
            <span className="text-sm font-bold">hours before</span>
          </label>
        </InlineForm>
      </AdminSection>

      {past.length > 0 && (
        <AdminSection title="Past slots (last 30 days)">
          <ul className="space-y-4">{past.map(slotCard)}</ul>
        </AdminSection>
      )}
    </>
  );
}
