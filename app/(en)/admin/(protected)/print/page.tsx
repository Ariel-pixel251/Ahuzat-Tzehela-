import type { Metadata } from "next";
import { buttonClass, PageTitle } from "@/components/ui";
import { eventForm, getCalendar } from "@/lib/calendar";

export const metadata: Metadata = { title: "Sign-up sheet" };

/** Pick events for the large-print Hebrew A4 sign-up sheet (with QR code). */
export default async function PrintGenerator() {
  const { upcoming } = await getCalendar();
  const events = upcoming.filter((e) => eventForm(e) !== null);
  return (
    <>
      <PageTitle lead="Choose events, open the sheet and print it. Type the paper answers in under “Register a resident”.">
        Printable sign-up sheet
      </PageTitle>
      <form action="/residents/events/print" method="get" target="_blank" className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="font-bold">Events</legend>
          {events.map((e, i) => (
            <label key={e.key} className="flex min-h-10 items-center gap-3">
              <input type="checkbox" name="e" value={e.key} defaultChecked={i < 4} className="size-5" />
              {e.title.en} · {e.date}
            </label>
          ))}
        </fieldset>
        <button type="submit" className={buttonClass.primary}>Open the sheet</button>
      </form>
    </>
  );
}
