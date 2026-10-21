import type { Metadata } from "next";
import { Agenda } from "@/components/students/Agenda";
import { Notice, PageTitle } from "@/components/ui";
import { upcomingWithCounts } from "@/lib/event-data";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.events.title };

export default async function EventsPage() {
  const { events, counts, source } = await upcomingWithCounts();
  return (
    <>
      <PageTitle lead={t.events.lead}>{t.events.title}</PageTitle>
      {source === "seed" && <Notice kind="warn" className="mb-6">{t.events.offline}</Notice>}
      <Agenda events={events} counts={counts} />
    </>
  );
}
