import type { Metadata } from "next";
import { cancelRegistrationByToken, registerResidentForEvent } from "@/app/actions/residents";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { SignUp } from "@/components/residents/SignUp";
import { eventForm, getEvent, registrationOpen } from "@/lib/calendar";
import { formatEventWhen } from "@/lib/i18n/format";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { v } from "@/lib/validation";
import { eventExtras } from "@/lib/resident-signup";

export const metadata: Metadata = { title: t.pages.register.title };

/** Sign up for one event (?event=key): the event is the time, so straight to name and phone. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> }) {
  const { event: key } = await searchParams;

  // the list of events lives on the events page; this page is the sign-up for one event
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
      <div className="mt-6">
        <SignUp
          fixed={event.location?.he ? t.signup.slotLabel(formatEventWhen(event, "he"), event.location.he) : formatEventWhen(event, "he")}
          extras={eventExtras(event)}
          hidden={{ event: event.key }}
          action={registerResidentForEvent}
          cancelAction={cancelRegistrationByToken}
        />
      </div>
    </>
  );
}
