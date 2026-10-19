import Link from "next/link";
import { AgendaItem } from "@/components/students/Agenda";
import { ButtonLink, PageTitle } from "@/components/ui";
import { upcomingWithCounts } from "@/lib/event-data";
import { studentsText as t } from "@/lib/i18n";

export const revalidate = 600;

const cards = [
  { href: "/students/digital", ...t.home.cards.digital },
  { href: "/students/podcast", ...t.home.cards.podcast },
  { href: "/students/lessons", ...t.home.cards.lessons },
  { href: "/students/courses", ...t.home.cards.courses },
  { href: "/students/share", ...t.home.cards.share },
  { href: "/students/visit", ...t.home.cards.visit },
];

export default async function StudentsHome() {
  const { events, counts } = await upcomingWithCounts();
  // the "key events" strip: tagged events first, then the rest
  const key = [...events.filter((e) => e.tags.length), ...events.filter((e) => !e.tags.length)].slice(0, 3)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <PageTitle lead={t.home.lead}>{t.home.title}</PageTitle>
      <section aria-labelledby="key-events" className="rounded-2xl bg-sand p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="key-events" className="text-2xl font-extrabold">{t.home.keyEvents}</h2>
          <ButtonLink href="/students/schedule" variant="small">{t.home.allEvents}</ButtonLink>
        </div>
        <ul className="space-y-3">
          {key.map((e) => (
            <AgendaItem key={e.key} event={e} confirmed={counts.get(e.key)} />
          ))}
        </ul>
      </section>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block h-full rounded-2xl border-2 border-line p-5 text-ink no-underline hover:border-brand">
              <h2 className="text-xl font-extrabold text-brand">{c.title}</h2>
              <p className="mt-1">{c.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
