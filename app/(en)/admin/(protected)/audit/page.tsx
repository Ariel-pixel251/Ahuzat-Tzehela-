import type { Metadata } from "next";
import { AdminSection, Table } from "@/components/admin";
import { PageTitle } from "@/components/ui";
import { adminPage } from "@/lib/admin-page";
import { listAudit } from "@/lib/db/misc";

export const metadata: Metadata = { title: "Audit log" };

/** Who viewed, exported or changed what (latest 300 entries, kept for two years). */
export default async function AdminAudit() {
  const { db } = await adminPage();
  const entries = await listAudit(db);
  return (
    <>
      <PageTitle lead="Every admin view of personal data, export and change.">Audit log</PageTitle>
      <AdminSection title="Latest entries">
        <Table
          head={["When", "Who", "What", "Target", "Details"]}
          rows={entries.map((e) => [
            e.at.toISOString().slice(0, 19).replace("T", " "),
            e.actor,
            e.action,
            e.target ?? "",
            <code key="d" className="break-all text-xs">{e.details ? JSON.stringify(e.details) : ""}</code>,
          ])}
        />
      </AdminSection>
    </>
  );
}
