import type { Metadata } from "next";
import { RegisterOnBehalf } from "@/components/RegisterOnBehalf";
import { PageTitle } from "@/components/ui";
import { adminPage } from "@/lib/admin-page";
import { eventForm, getCalendar } from "@/lib/calendar";
import { freePlaces, listUpcomingSlots } from "@/lib/db/slots";
import { listUpcomingTimes, placesLeft } from "@/lib/db/podcast";
import { formatPodcastTime, formatSlot } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Register a resident" };

export default async function RegisterResident() {
  const { admin, db } = await adminPage();
  const [calendar, slots, times] = await Promise.all([getCalendar(), listUpcomingSlots(db), listUpcomingTimes(db)]);
  const events = calendar.upcoming
    .map((e) => ({ e, form: eventForm(e) }))
    .filter(({ form }) => form && form !== "podcast")
    .map(({ e, form }) => ({ key: e.key, label: `${e.title.en} (${e.date})`, form: form!, languages: e.languages }));
  const slotChoices = slots
    .filter((s) => s.status === "scheduled" && s.starts_at > new Date())
    .map((s) => ({ id: s.id, label: `${formatSlot(s, "en")} (${freePlaces(s)} of ${s.resident_places} places free)`, full: freePlaces(s) === 0 }));
  return (
    <>
      <PageTitle lead="For phone calls and residents who prefer not to use the site. Saved as &quot;registered by staff&quot;.">
        Register a resident
      </PageTitle>
      <RegisterOnBehalf
        staff={admin.email}
        events={events}
        slots={slotChoices}
        podcastTimes={times.map((x) => ({
          id: x.id,
          label: `${formatPodcastTime(x, "en")} (${placesLeft(x, "resident")} of ${x.pairs} resident places free${x.open ? "" : ", closed"})`,
        }))}
      />
    </>
  );
}
