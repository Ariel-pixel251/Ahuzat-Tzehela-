import Link from "next/link";
import { Announcements } from "@/components/Announcements";
import { Nav } from "@/components/students/Nav";
import { studentsText as t } from "@/lib/i18n";

// the announcement banner comes from the database: refresh static pages every 5 minutes
export const revalidate = 300;

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    { href: "/students", label: t.nav.home },
    { href: "/students/schedule", label: t.nav.schedule },
    { href: "/students/digital", label: t.nav.digital },
    { href: "/students/podcast", label: t.nav.podcast },
  ];
  return (
    <>
      <a href="#main" className="sr-only-focusable absolute start-2 top-2 z-10 rounded bg-white p-2 font-bold">
        {t.skip}
      </a>
      <header className="no-print border-b-2 border-line bg-sand">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/students" className="text-lg font-extrabold text-ink no-underline">
            {t.brand}
          </Link>
          <Nav items={nav} label={t.nav.label} />
        </div>
      </header>
      <Announcements locale="en" label={t.announcement} />
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
      <footer className="no-print mx-auto max-w-4xl border-t-2 border-line px-4 py-6 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li><Link className="underline" href="/students/privacy">{t.privacy.title}</Link></li>
          <li><Link className="underline" href="/students/share">{t.share.title}</Link></li>
          <li><Link className="underline" href="/students/courses">{t.courses.title}</Link></li>
          <li><Link className="underline" href="/residents" lang="he">פורטל הדיירים</Link></li>
        </ul>
      </footer>
    </>
  );
}
