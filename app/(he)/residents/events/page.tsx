import type { Metadata } from "next";
import Link from "next/link";
import { PrintIcon } from "@/components/icons";
import { EventCard } from "@/components/residents/EventCard";
import { buttonClass, Notice } from "@/components/ui";
import { upcomingWithCounts } from "@/lib/event-data";
import { residentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.events.title };
export const revalidate = 600;

/** The next 5 events as large cards; "לראות עוד" shows more. */
export default async function ResidentEvents({ searchParams }: { searchParams: Promise<{ more?: string }> }) {
  const { more } = await searchParams;
  const { events, counts, source } = await upcomingWithCounts();
  const shown = events.slice(0, more ? 30 : 5);
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.events.title}</h1>
      {source === "seed" && <Notice kind="warn" className="mb-6 text-xl">{t.events.offline}</Notice>}
      {shown.length === 0 ? (
        <p className="text-2xl">{t.events.none}</p>
      ) : (
        <ul className="space-y-6">
          {shown.map((e) => (
            <EventCard key={e.key} event={e} confirmed={counts.get(e.key)} />
          ))}
        </ul>
      )}
      <div className="no-print mt-8 space-y-3">
        {!more && events.length > shown.length && (
          <Link href="/residents/events?more=1" className={`${buttonClass.secondary} w-full min-h-[72px] text-2xl`}>
            {t.events.more}
          </Link>
        )}
        <Link href="/residents/events/print" className={`${buttonClass.secondary} w-full`}>
          <PrintIcon className="size-7" />
          {t.events.print}
        </Link>
      </div>
    </>
  );
}
