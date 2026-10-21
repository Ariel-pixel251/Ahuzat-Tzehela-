import type { Metadata } from "next";
import { markReportHandled, unblockContactAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { BlockForm, DeletePersonForm } from "@/components/admin/SafetyForms";
import { Badge, PageTitle } from "@/components/ui";
import { adminPage } from "@/lib/admin-page";
import { listBlocked, listProblemReports } from "@/lib/db/misc";

export const metadata: Metadata = { title: "Reports and privacy" };

/** "Report a problem" messages, blocked people, and deleting everything about a person. */
export default async function AdminSafety() {
  const { db } = await adminPage("reports-and-privacy");
  const [reports, blocked] = await Promise.all([listProblemReports(db), listBlocked(db)]);
  return (
    <>
      <PageTitle>Reports and privacy</PageTitle>
      <AdminSection title="Problem reports" actions={<CsvLink dataset="reports" />}>
        <Table
          head={["When", "From", "Message", ""]}
          empty="No reports."
          rows={reports.map((r) => [
            r.created_at.toISOString().slice(0, 16).replace("T", " "),
            <div key="f">
              <Badge>{r.portal}</Badge>
              {r.name && <p>{r.name}</p>}
              {r.contact && <p dir="ltr" className="text-start">{r.contact}</p>}
            </div>,
            <p key="m" className="max-w-prose whitespace-pre-line">{r.message}</p>,
            r.status === "new" ? (
              <ActionButton key="a" action={markReportHandled} fields={{ id: r.id }} label="Mark handled" variant="small" />
            ) : (
              <Badge key="a" tone="ok">handled</Badge>
            ),
          ])}
        />
      </AdminSection>

      <AdminSection title="Block a person">
        <p className="mb-3">A blocked phone or email can&apos;t register, book, volunteer or sign in as a student.</p>
        <BlockForm />
        <div className="mt-4">
          <Table
            head={["Blocked", "Reason", "By", ""]}
            empty="Nobody is blocked."
            rows={blocked.map((b) => [
              <span key="v" dir="ltr">{b.value}</span>,
              b.reason ?? "",
              b.blocked_by,
              <ActionButton key="a" action={unblockContactAction} fields={{ id: b.id }} label="Unblock" variant="small" />,
            ])}
          />
        </div>
      </AdminSection>

      <AdminSection title="Delete all data for a person">
        <p className="mb-3">For &quot;please delete my details&quot; requests. Logged in the audit log (without the phone or email).</p>
        <DeletePersonForm />
      </AdminSection>
    </>
  );
}
