import Link from "next/link";
import { AgendaItem } from "@/components/students/Agenda";
import { ButtonLink } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { upcomingWithCounts } from "@/lib/event-data";
import { studentsText as t } from "@/lib/i18n";

const cards = [
  { href: "/students/events", ...t.home.cards.events },
  { href: "/students/digital-support", ...t.home.cards.digital },
  { href: "/students/podcast", ...t.home.cards.podcast },
  { href: "/students/mine", ...t.home.cards.mine },
];

export default async function StudentsHome() {
  const { events, counts } = await upcomingWithCounts();
  // "coming up": tagged events first, then the rest
  const next = [...events.filter((e) => e.tags.length), ...events.filter((e) => !e.tags.length)]
    .slice(0, 3)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <Wordmark name={t.brand} subtitle={t.subtitle} accent="emis" className="mb-8" />
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block h-full rounded-2xl border-2 border-t-8 border-line border-t-emis p-5 text-ink no-underline hover:border-brand hover:border-t-emis">
              <h2 className="text-xl font-extrabold text-brand">{c.title}</h2>
              <p className="mt-1">{c.text}</p>
            </Link>
          </li>
        ))}
      </ul>
      {next.length > 0 && (
        <section aria-labelledby="coming-up" className="mt-8 rounded-2xl bg-sand p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="coming-up" className="text-2xl font-extrabold">{t.home.keyEvents}</h2>
            <ButtonLink href="/students/events" variant="small">{t.home.allEvents}</ButtonLink>
          </div>
          <ul className="space-y-3">
            {next.map((e) => (
              <AgendaItem key={e.key} event={e} confirmed={counts.get(e.key)} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
