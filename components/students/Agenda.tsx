import Link from "next/link";
import { Badge, buttonClass } from "@/components/ui";
import { groupByMonth, type CalendarEvent } from "@/lib/calendar/parse";
import { eventAction } from "@/lib/event-links";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { dateBadge, formatEventWhen, formatMonth } from "@/lib/i18n/format";

/** Upcoming events grouped by month, with the registration button each event's tag calls for. */
export function Agenda({ events, counts }: { events: CalendarEvent[]; counts: Map<string, number> }) {
  if (!events.length) return <p>{t.events.none}</p>;
  return (
    <div className="space-y-10">
      {groupByMonth(events).map((group) => (
        <section key={group.month} aria-labelledby={`m-${group.month}`}>
          <h2 id={`m-${group.month}`} className="mb-3 border-b-2 border-ink pb-1 text-2xl font-extrabold">
            {formatMonth(group.month, "en")}
          </h2>
          <ul className="space-y-4">
            {group.events.map((e) => (
              <AgendaItem key={e.key} event={e} confirmed={counts.get(e.key)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function AgendaItem({ event, confirmed }: { event: CalendarEvent; confirmed?: number }) {
  const badge = dateBadge(event.date, "en");
  const action = eventAction(event, "students", confirmed);
  const labels = { register: t.events.register, podcast: t.events.joinPodcast };
  const placesLeft = event.capacity !== undefined ? Math.max(event.capacity - (confirmed ?? 0), 0) : null;
  return (
    <li className="flex gap-4 rounded-2xl border-2 border-line bg-white p-4">
      <div aria-hidden="true" className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft py-2 text-brand">
        <span className="text-sm font-bold uppercase">{badge.weekday}</span>
        <span className="text-3xl font-extrabold leading-none">{badge.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl font-extrabold">{event.title.en}</h3>
        <p className="font-medium">{formatEventWhen(event, "en")}</p>
        {event.location && <p className="text-muted">{event.location.en}</p>}
        {event.description && <p className="mt-1 whitespace-pre-line">{event.description.en}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {event.tbc && <Badge tone="warn">{sharedText.en.tbc}</Badge>}
          {action?.kind === "link" && action.label === "register" && placesLeft !== null && (
            <Badge tone={action.full ? "bad" : "neutral"}>{action.full ? t.events.full : t.events.placesLeft(placesLeft)}</Badge>
          )}
          {event.closes && action?.kind === "link" && <Badge>{t.events.closes(dateBadge(event.closes, "en").short)}</Badge>}
          {action?.kind === "closed" && <Badge>{t.events.closed}</Badge>}
        </div>
        {action?.kind === "link" && (
          <Link href={action.href} className={`${buttonClass.primary} mt-3`}>
            {labels[action.label]}
            <span className="sr-only">: {event.title.en}</span>
          </Link>
        )}
      </div>
    </li>
  );
}
