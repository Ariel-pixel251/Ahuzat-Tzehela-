import type { Metadata } from "next";
import { registerResidentForEvent } from "@/app/actions/residents";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { Wizard } from "@/components/Wizard";
import { eventForm, getEvent, registrationOpen } from "@/lib/calendar";
import { formatEventWhen } from "@/lib/i18n/format";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { v } from "@/lib/validation";
import { eventSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.register.title };

/** The registration wizard for one event (?event=key). */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const { event: key } = await searchParams;

  // the list of events lives on the events page; this page is the wizard for one event
  if (!key) redirect("/residents/events");
  const parsed = v.eventKey.safeParse(key);
  if (!parsed.success) return <Notice kind="bad">{sharedText.he.errors.notFound}</Notice>;

  const event = await getEvent(parsed.data);
  const form = event ? eventForm(event) : null;
  if (form === "podcast") redirect("/residents/podcast");
  if (!event || !form) return <Notice kind="bad">{sharedText.he.errors.notFound}</Notice>;
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
