import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EventRegistrationForm } from "@/components/students/EventRegistrationForm";
import { Badge, Notice, PageTitle } from "@/components/ui";
import { eventForm, getEvent, registrationOpen } from "@/lib/calendar";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { formatEventWhen } from "@/lib/i18n/format";

export const metadata: Metadata = { title: t.register.title };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event: key = "" } = await searchParams;
  const event = await getEvent(key);
  const form = event ? eventForm(event) : null;
  if (form === "podcast") redirect("/students/podcast");
  if (form === "digital-support") redirect("/students/digital");
  if (!event || !form) {
    return <Notice kind="bad">{sharedText.en.errors.notFound}</Notice>;
  }
  return (
    <>
      <PageTitle lead={`${formatEventWhen(event, "en")}${event.location ? ` · ${event.location.en}` : ""}`}>
        {t.register.title}: {event.title.en}
      </PageTitle>
      {event.tbc && <p className="mb-4"><Badge tone="warn">{sharedText.en.tbc}</Badge></p>}
      {registrationOpen(event) ? (
        <EventRegistrationForm
          eventKey={event.key}
          title={event.title.en}
          form={form}
          showLanguages={form === "language-night" || event.languages}
        />
      ) : (
        <Notice kind="warn">{sharedText.en.errors.closed}</Notice>
      )}
    </>
  );
}
