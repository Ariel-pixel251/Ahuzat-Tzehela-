import type { Metadata } from "next";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { StatusButtons } from "@/components/StatusButtons";
import { Badge, PageTitle } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { listVisitRequests } from "@/lib/db/misc";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Visit requests" };

export default async function AdminVisits() {
  const rows = await listVisitRequests(await getDb());
  return (
    <>
      <PageTitle>Visit requests</PageTitle>
      <AdminSection title="Come and see a day at the estate" actions={<CsvLink dataset="visits" />}>
        <Table
          head={["Name", "Organisation", "Contact", "Dates", "Group", "Notes", "Status", ""]}
          rows={rows.map((r) => [
            r.name,
            r.organization ?? "",
            <span key="c" dir="ltr">{[r.email, formatPhone(r.phone)].filter(Boolean).join(" · ")}</span>,
            r.preferred_dates ?? "",
            r.group_size ?? "",
            r.notes ?? "",
            <Badge key="s" tone={r.status === "new" ? "warn" : "neutral"}>{r.status}</Badge>,
            <StatusButtons key="b" kind="visit" id={r.id} current={r.status} statuses={["new", "scheduled", "declined"]} />,
          ])}
        />
      </AdminSection>
    </>
  );
}
