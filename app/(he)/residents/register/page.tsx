import type { Metadata } from "next";
import { registerResidentForEvent } from "@/app/actions/residents";
import Link from "next/link";
import { EventCard } from "@/components/residents/EventCard";
import { buttonClass, Notice } from "@/components/ui";
import { Wizard } from "@/components/Wizard";
import { eventForm, getEvent, registrationOpen } from "@/lib/calendar";
import { upcomingWithCounts } from "@/lib/event-data";
import { formatEventWhen } from "@/lib/i18n/format";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { eventSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.register.title };

/** Without ?event: the events open for registration. With ?event: the registration wizard. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ event?: string; more?: string }> }) {
  const { event: key, more } = await searchParams;

  if (!key) {
    const { events, counts } = await upcomingWithCounts((e) => eventForm(e) !== null);
    const shown = events.slice(0, more ? 30 : 5);
    return (
      <>
        <h1 className="mb-6 text-4xl font-extrabold">{t.events.registerTitle}</h1>
        {shown.length === 0 ? (
          <p className="text-2xl">{t.events.noneToRegister}</p>
        ) : (
          <ul className="space-y-6">
            {shown.map((e) => (
              <EventCard key={e.key} event={e} confirmed={counts.get(e.key)} />
            ))}
          </ul>
        )}
        {!more && events.length > shown.length && (
          <Link href="/residents/register?more=1" className={`${buttonClass.secondary} mt-8 w-full min-h-[72px] text-2xl`}>
            {t.events.more}
          </Link>
        )}
      </>
    );
  }

  const event = await getEvent(key);
  if (!event || !eventForm(event)) return <Notice kind="bad">{sharedText.he.errors.notFound}</Notice>;
  if (!registrationOpen(event)) return <Notice kind="warn">{sharedText.he.errors.closed}</Notice>;

  return (
    <>
      <h1 className="text-4xl font-extrabold">{event.title.he}</h1>
      <p className="mb-6 mt-2 text-2xl font-bold">{formatEventWhen(event, "he")}</p>
      <Wizard
        steps={eventSteps(event)}
        action={registerResidentForEvent}
        hidden={{ event: event.key }}
        done={t.confirm.event(event.title.he)}
        doneWaitlist={t.confirm.waitlist}
      />
    </>
  );
}
