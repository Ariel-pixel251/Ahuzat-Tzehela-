import type { Metadata } from "next";
import { approveDigitalMatch, assignDigital, setDigitalStatus, toggleMatchApproval } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { InlineForm } from "@/components/forms";
import { Badge, PageTitle } from "@/components/ui";
import { languageName } from "@/config/languages";
import { DAYS, DIGITAL_NEEDS, formatHours, optionLabel } from "@/config/options";
import { getDb } from "@/lib/db/client";
import { listAllDigitalRequests } from "@/lib/db/digital";
import { listStudents } from "@/lib/db/students";
import { requireMatchApproval } from "@/lib/domain";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Digital support" };

export default async function AdminDigital() {
  const db = await getDb();
  const [requests, students, approval] = await Promise.all([listAllDigitalRequests(db), listStudents(db), requireMatchApproval(db)]);
  return (
    <>
      <PageTitle>Digital support requests</PageTitle>
      <AdminSection title="Settings">
        <InlineForm action={toggleMatchApproval} submitLabel="Save">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="value" defaultChecked={approval} className="size-5" />
            A leader must approve each match before contact details are shared
          </label>
        </InlineForm>
      </AdminSection>
      <AdminSection title="Requests" actions={<CsvLink dataset="digital" />}>
        <Table
          head={["Resident", "Needs", "When / language", "Status", "Volunteer", "Actions"]}
          rows={requests.map((r) => [
            <div key="r">
              <p className="font-bold">{r.resident_name}</p>
              <p dir="ltr" className="text-start">{formatPhone(r.resident_phone)}</p>
              {r.resident_email && <p>{r.resident_email}</p>}
              <p className="text-muted">Code {r.code}{r.registered_by ? ` · ${r.registered_by}` : ""}</p>
            </div>,
            <span key="n">{r.needs.map((n) => optionLabel(DIGITAL_NEEDS, n, "en")).join(", ")}{r.needs_other ? ` (${r.needs_other})` : ""}</span>,
            <span key="w">
              {[r.preferred_days.map((d) => optionLabel(DAYS, d, "en")).join(", "), formatHours(r.preferred_parts, "en")].filter(Boolean).join(" · ")}
              {" · "}{languageName(r.language, "en")}
            </span>,
            <span key="s" className="flex flex-col gap-1">
              <Badge tone={r.status === "open" ? "warn" : r.status === "done" ? "ok" : "neutral"}>{r.status}</Badge>
              {r.status === "assigned" && !r.approved_at && <Badge tone="warn">needs approval</Badge>}
            </span>,
            r.student_name ? <span key="v">{r.student_name}<br />{r.student_email}</span> : "",
            <div key="a" className="flex flex-col gap-2">
              {(r.status === "open" || r.status === "assigned") && (
                <InlineForm action={assignDigital} submitLabel="Assign">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="sr-only" htmlFor={`s-${r.id}`}>Volunteer</label>
                  <select id={`s-${r.id}`} name="student" defaultValue={r.student_id ?? ""} className="min-h-10 rounded border-2 border-ink px-2">
                    <option value="">(open, no volunteer)</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </InlineForm>
              )}
              {r.status === "assigned" && !r.approved_at && <ActionButton action={approveDigitalMatch} fields={{ id: r.id }} label="Approve match" variant="small" />}
              {r.status === "assigned" && <ActionButton action={setDigitalStatus} fields={{ id: r.id, status: "done" }} label="Mark done" variant="small" />}
              {(r.status === "open" || r.status === "assigned") && <ActionButton action={setDigitalStatus} fields={{ id: r.id, status: "cancelled" }} label="Cancel" variant="small" />}
            </div>,
          ])}
        />
      </AdminSection>
    </>
  );
}
