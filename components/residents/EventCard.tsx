import Link from "next/link";
import { buttonClass } from "@/components/ui";
import type { CalendarEvent } from "@/lib/calendar/parse";
import { eventAction } from "@/lib/event-links";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { formatEventWhen } from "@/lib/i18n/format";

/** A large event card: title, day in words, time, place, one sentence, one big button. */
export function EventCard({ event, confirmed }: { event: CalendarEvent; confirmed?: number }) {
  const action = eventAction(event, "residents", confirmed);
  const sentence = event.description?.he.split("\n")[0];
  const labels = { register: t.events.iWantToCome, podcast: t.events.joinPodcast };
  return (
    <li className="rounded-2xl border-4 border-ink bg-white p-5">
      <h2 className="text-3xl font-extrabold leading-snug">{event.title.he}</h2>
      <p className="mt-2 text-2xl font-bold">{formatEventWhen(event, "he")}</p>
      {event.location && (
        <p className="mt-1 text-xl">
          {t.events.where} {event.location.he}
        </p>
      )}
      {sentence && <p className="mt-2 text-xl">{sentence}</p>}
      {event.tbc && <p className="mt-2 inline-block rounded-lg bg-warn-soft px-3 py-1 text-xl font-bold text-warn">{sharedText.he.tbc}</p>}
      {action?.kind === "closed" && <p className="mt-3 text-xl font-bold">{t.events.closed}</p>}
      {action?.kind === "link" && (
        <>
          {action.full && <p className="mt-3 text-xl font-bold text-warn">{t.events.full}</p>}
          <Link href={action.href} className={`${buttonClass.primary} mt-4 w-full min-h-[72px] text-2xl`}>
            {labels[action.label]}
            <span className="sr-only">: {event.title.he}</span>
          </Link>
        </>
      )}
    </li>
  );
}
