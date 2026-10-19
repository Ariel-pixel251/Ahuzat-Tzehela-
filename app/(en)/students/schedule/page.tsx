import type { Metadata } from "next";
import { Agenda } from "@/components/students/Agenda";
import { Notice, PageTitle } from "@/components/ui";
import { upcomingWithCounts } from "@/lib/event-data";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.schedule.title };
export const revalidate = 600;

export default async function SchedulePage() {
  const { events, counts, source } = await upcomingWithCounts();
  return (
    <>
      <PageTitle lead={t.schedule.lead}>{t.schedule.title}</PageTitle>
      {source === "seed" && <Notice kind="warn" className="mb-6">{t.schedule.offline}</Notice>}
      <Agenda events={events} counts={counts} />
    </>
  );
}
