import type { Metadata } from "next";
import { sendCancellationNotice } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { Badge, Notice, PageTitle } from "@/components/ui";
import { languageName } from "@/config/languages";
import { eventSummaries, HEALTH_LABEL } from "@/lib/admin-data";
import { getCalendar } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Event registrations" };

export default async function AdminEvents() {
  const db = await getDb();
  const calendar = await getCalendar();
  const events = await eventSummaries(db, calendar);
  return (
    <>
      <PageTitle lead="Registrations grouped by calendar event, past events included. Registrations are kept when an event changes in the calendar.">
        Event registrations
      </PageTitle>
      <div className="mb-6"><CsvLink dataset="registrations" /></div>
      {events.length === 0 && <p>No registrations yet.</p>}
      {events.map((e) => {
        const byLanguage = new Map<string, number>();
        for (const r of e.registrations.filter((r) => r.status !== "cancelled")) {
          for (const l of r.kind === "game-night" ? [r.preferred_language ?? "none"] : r.languages) {
            byLanguage.set(l, (byLanguage.get(l) ?? 0) + r.attendees);
          }
        }
        const problem = e.health === "cancelled" || e.health === "removed";
        return (
          <AdminSection
            key={e.key}
            title={`${e.titleEn} · ${e.date}${e.time ? ` ${e.time}` : ""}`}
            actions={<Badge tone={problem || e.health === "time-changed" ? "warn" : "neutral"}>{HEALTH_LABEL[e.health]}{e.currentWhen ? ` → ${e.currentWhen}` : ""}</Badge>}
          >
            <p className="mb-2">
              {e.confirmedPeople} confirmed · {e.waitlistPeople} on the waiting list
            </p>
            {problem && (
              <Notice kind="warn" className="mb-3">
                {e.noticeSent ? (
                  "A cancellation notice was sent to the registrants."
                ) : (
                  <ActionButton action={sendCancellationNotice} fields={{ key: e.key }} label="Notify all registrants (English + Hebrew)" />
                )}
              </Notice>
            )}
            {byLanguage.size > 0 && (
              <p className="mb-2">
                <span className="font-bold">{e.registrations[0].kind === "game-night" ? "Tables by preferred language: " : "Languages: "}</span>
                {[...byLanguage.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([l, n]) => `${l === "none" ? "No preference" : languageName(l, "en")} (${n})`)
                  .join(" · ")}
              </p>
            )}
            <Table
              head={["Name", "Portal", "Phone", "Email", "People", "Details", "Status", "Code", "Registered by"]}
              rows={e.registrations.map((r) => [
                r.name,
                r.portal,
                <span key="p" dir="ltr">{formatPhone(r.phone)}</span>,
                r.email ?? "",
                r.attendees,
                [
                  r.languages.map((l) => languageName(l, "en")).join(", "),
                  r.other_language,
                  r.preferred_language ? `prefers ${languageName(r.preferred_language, "en")}` : "",
                  r.role,
                  r.notes,
                ].filter(Boolean).join(" · "),
                r.status,
                r.code,
                r.registered_by ?? "",
              ])}
            />
          </AdminSection>
        );
      })}
    </>
  );
}
