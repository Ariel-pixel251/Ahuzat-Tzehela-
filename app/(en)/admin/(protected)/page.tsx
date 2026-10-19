import type { Metadata } from "next";
import Link from "next/link";
import { AdminSection, Stat, Table } from "@/components/admin";
import { Badge, Notice, PageTitle } from "@/components/ui";
import { eventSummaries, HEALTH_LABEL } from "@/lib/admin-data";
import { daysFromToday, getCalendar } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import { listAllDigitalRequests } from "@/lib/db/digital";
import { listCallbacks, listMessages } from "@/lib/db/misc";
import { listParticipants } from "@/lib/db/podcast";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function Dashboard() {
  const db = await getDb();
  const calendar = await getCalendar();
  const [events, digital, people, callbacks, messages] = await Promise.all([
    eventSummaries(db, calendar),
    listAllDigitalRequests(db),
    listParticipants(db),
    listCallbacks(db),
    listMessages(db),
  ]);
  const problems = events.filter((e) => ["cancelled", "removed", "time-changed"].includes(e.health));
  // keep the dashboard short: one row per untagged series, tagged events of the next 60 days
  const untagged = calendar.upcoming
    .filter((e, i, all) => e.tags.length === 0 && all.findIndex((x) => x.uid === e.uid) === i)
    .slice(0, 10);
  const horizon = daysFromToday(60);
  const upcomingCounts = calendar.upcoming
    .filter((e) => e.tags.length && e.date <= horizon)
    .slice(0, 15)
    .map((e) => ({ e, s: events.find((x) => x.key === e.key) }));
  return (
    <>
      <PageTitle>Dashboard</PageTitle>
      {calendar.source === "seed" && (
        <Notice kind="warn" className="mb-6">
          The Google Calendar feed couldn&apos;t be read ({calendar.error}). The site is showing the offline seed events.
        </Notice>
      )}
      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open digital requests" value={digital.filter((d) => d.status === "open").length} />
        <Stat label="Assigned digital requests" value={digital.filter((d) => d.status === "assigned").length} />
        <Stat label="Podcast people without a pair" value={people.filter((p) => p.active && p.status !== "paired").length} />
        <Stat label="Open callback requests" value={callbacks.filter((c) => !c.handled).length} tone={callbacks.some((c) => !c.handled) ? "warn" : "neutral"} />
        <Stat label="Messages to send by hand" value={messages.filter((m) => m.status === "pending").length} tone={messages.some((m) => m.status === "pending") ? "warn" : "neutral"} />
        <Stat label="Cancelled or changed events" value={problems.length} tone={problems.length ? "warn" : "neutral"} />
      </div>

      {problems.length > 0 && (
        <AdminSection title="Events that changed after people registered">
          <Table
            head={["Event", "Registered for", "Status", ""]}
            rows={problems.map((e) => [
              e.titleEn,
              `${e.date} ${e.time ?? ""}`,
              <Badge key="h" tone="warn">{HEALTH_LABEL[e.health]}{e.currentWhen ? ` → ${e.currentWhen}` : ""}</Badge>,
              <Link key="l" href="/admin/events" className="underline">Open</Link>,
            ])}
          />
        </AdminSection>
      )}

      <AdminSection title="Sign-ups for the next 60 days">
        <Table
          head={["Event", "Date", "Confirmed people", "Waiting list", "Capacity"]}
          rows={upcomingCounts.map(({ e, s }) => [
            e.title.en,
            `${e.date} ${e.startTime ?? ""}`,
            s?.confirmedPeople ?? 0,
            s?.waitlistPeople ?? 0,
            e.capacity ?? "–",
          ])}
          empty="No tagged upcoming events."
        />
      </AdminSection>

      {untagged.length > 0 && (
        <AdminSection title="Calendar events without a tag (no registration button)">
          <Notice kind="warn" className="mb-3">
            Add a tag such as [register] or [party] to the event title or description in Google Calendar to open registration.
          </Notice>
          <Table head={["Event", "Date"]} rows={untagged.map((e) => [e.title.en, `${e.date} ${e.startTime ?? ""}`])} />
        </AdminSection>
      )}
    </>
  );
}
