import type { Metadata } from "next";
import { markMessageSent } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { Notice, PageTitle } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { listMessages } from "@/lib/db/misc";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Messages to send by hand" };

const whatsapp = (phone: string, body: string) =>
  `https://wa.me/${phone.startsWith("+") ? phone.slice(1) : `972${phone.slice(1)}`}?text=${encodeURIComponent(body)}`;

export default async function AdminMessages() {
  const rows = await listMessages(await getDb());
  return (
    <>
      <PageTitle>Messages to send by hand</PageTitle>
      <Notice className="mb-6">
        Residents get confirmations and reminders by text message. Until an SMS provider is connected, send these by
        WhatsApp or SMS yourself, then mark them as sent.
      </Notice>
      <AdminSection title="Queue" actions={<CsvLink dataset="messages" />}>
        <Table
          head={["To", "Message", "Created", ""]}
          rows={rows.map((m) => [
            <span key="t">{m.to_name}<br /><span dir="ltr">{formatPhone(m.to_phone)}</span></span>,
            <p key="b" lang="he" dir="auto" className="whitespace-pre-line">{m.body}</p>,
            m.created_at.toISOString().slice(0, 16).replace("T", " "),
            m.status === "sent" ? (
              "Sent"
            ) : (
              <div key="a" className="flex flex-col gap-1">
                <a href={whatsapp(m.to_phone, m.body)} target="_blank" rel="noopener noreferrer" className="underline">Open in WhatsApp</a>
                <a href={`sms:${m.to_phone}?body=${encodeURIComponent(m.body)}`} className="underline">Open as SMS</a>
                <ActionButton action={markMessageSent} fields={{ id: m.id }} label="Mark sent" variant="small" />
              </div>
            ),
          ])}
          empty="No messages."
        />
      </AdminSection>
    </>
  );
}
