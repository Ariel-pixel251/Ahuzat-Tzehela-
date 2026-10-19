import type { Metadata } from "next";
import { RegisterOnBehalf } from "@/components/RegisterOnBehalf";
import { PageTitle } from "@/components/ui";
import { getAdmin } from "@/lib/auth/admin";
import { eventForm, getCalendar } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import { listLessonTopics } from "@/lib/db/misc";

export const metadata: Metadata = { title: "Register a resident" };

export default async function RegisterResident() {
  const [admin, calendar, topics] = await Promise.all([getAdmin(), getCalendar(), listLessonTopics(await getDb())]);
  const events = calendar.upcoming
    .map((e) => ({ e, form: eventForm(e) }))
    .filter(({ form }) => form && form !== "podcast" && form !== "digital-support")
    .map(({ e, form }) => ({ key: e.key, label: `${e.title.en} (${e.date})`, form: form!, languages: e.languages }));
  return (
    <>
      <PageTitle lead="For phone calls, paper sign-up sheets and residents who prefer not to use the site. Saved as &quot;registered by staff&quot;.">
        Register a resident
      </PageTitle>
      <RegisterOnBehalf staff={admin?.email ?? ""} events={events} topics={topics} />
    </>
  );
}
