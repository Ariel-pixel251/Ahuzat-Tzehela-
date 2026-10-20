import type { Metadata } from "next";
import { toggleCallback } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { PageTitle } from "@/components/ui";
import { adminPage } from "@/lib/admin-page";
import { listCallbacks } from "@/lib/db/misc";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Callback requests" };

export default async function AdminCallbacks() {
  const { db } = await adminPage("callbacks");
  const rows = await listCallbacks(db);
  return (
    <>
      <PageTitle>Callback requests (&quot;צרו איתי קשר&quot;)</PageTitle>
      <AdminSection title="Residents who asked us to call" actions={<CsvLink dataset="callbacks" />}>
        <Table
          head={["Handled", "Name", "Phone", "Asked on", "Entered by"]}
          rows={rows.map((r) => [
            <ActionButton key="h" action={toggleCallback} fields={{ id: r.id }} label={r.handled ? "✓ Handled (undo)" : "Mark handled"} variant="small" />,
            r.name,
            <a key="p" href={`tel:${r.phone}`} dir="ltr" className="underline">{formatPhone(r.phone)}</a>,
            r.created_at.toISOString().slice(0, 16).replace("T", " "),
            r.registered_by ?? "",
          ])}
        />
      </AdminSection>
    </>
  );
}
