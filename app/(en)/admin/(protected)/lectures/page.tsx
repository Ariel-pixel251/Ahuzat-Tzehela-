import type { Metadata } from "next";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { StatusButtons } from "@/components/StatusButtons";
import { Badge, PageTitle } from "@/components/ui";
import { languageName } from "@/config/languages";
import { getDb } from "@/lib/db/client";
import { listLectureProposals } from "@/lib/db/misc";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Lecture proposals" };

export default async function AdminLectures() {
  const rows = await listLectureProposals(await getDb());
  return (
    <>
      <PageTitle>Lecture proposals</PageTitle>
      <AdminSection title="Proposals from residents" actions={<CsvLink dataset="lectures" />}>
        <Table
          head={["Resident", "Topic", "Language", "Preferred date", "Description", "Status", ""]}
          rows={rows.map((r) => [
            <span key="n">{r.name}<br /><span dir="ltr">{formatPhone(r.phone)}</span>{r.email ? <><br />{r.email}</> : null}</span>,
            r.topic,
            languageName(r.language, "en"),
            r.preferred_date ?? "",
            r.description ?? "",
            <Badge key="s" tone={r.status === "new" ? "warn" : r.status === "accepted" ? "ok" : "neutral"}>{r.status}</Badge>,
            <StatusButtons key="b" kind="lecture" id={r.id} current={r.status} statuses={["new", "accepted", "declined"]} />,
          ])}
        />
      </AdminSection>
    </>
  );
}
