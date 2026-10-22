import Link from "next/link";
import { BrandStripe, LogoBar } from "@/components/Logos";
import { Nav } from "@/components/students/Nav";
import { studentsText as t } from "@/lib/i18n";

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    { href: "/students", label: t.nav.home },
    { href: "/students/events", label: t.nav.events },
    { href: "/students/digital-support", label: t.nav.digital },
    { href: "/students/podcast", label: t.nav.podcast },
    { href: "/students/mine", label: t.nav.mine },
  ];
  return (
    <>
      <a href="#main" className="sr-only-focusable absolute start-2 top-2 z-10 rounded bg-white p-2 font-bold">
        {t.skip}
      </a>
      <header className="border-b-2 border-line">
        <LogoBar place="header" locale="en" href="/students" label={t.logosHome} priority className="px-4 py-3 text-center" />
        <BrandStripe />
        <div className="no-print bg-sand">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/students" className="text-lg font-black tracking-tight text-ink no-underline">
              {t.brand}
            </Link>
            <Nav items={nav} label={t.nav.label} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
      <footer className="no-print mx-auto max-w-4xl border-t-2 border-line px-4 py-6 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li><Link className="inline-flex min-h-10 items-center underline" href="/students/privacy">{t.footer.privacy}</Link></li>
          <li><Link className="inline-flex min-h-10 items-center underline" href="/students/report">{t.footer.report}</Link></li>
          <li><Link className="inline-flex min-h-10 items-center underline" href="/residents" lang="he">{t.footer.residents}</Link></li>
        </ul>
        <LogoBar place="footer" locale="en" className="mt-6" />
      </footer>
    </>
  );
}
