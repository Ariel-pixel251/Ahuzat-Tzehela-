import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { PartnerLogo, PartnersStrip } from "@/components/Logos";
import { Nav } from "@/components/students/Nav";
import { BRAND } from "@/config/brand";
import { LOGO_SPACING } from "@/config/logos";
import { studentsText as t } from "@/lib/i18n";

/**
 * Student portal frame: "Together for Generations, EMIS Branch" linking home, the EMIS logo at the
 * end, then the menu. Footer: the partners, the disclaimer and the links.
 */
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
      <header className="border-b-2 border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4" style={{ paddingBlock: LOGO_SPACING.headerPadding }}>
          <BrandLockup locale="en" variant="header" href="/students" priority />
          <PartnerLogo name="emis" place="header" locale="en" priority />
        </div>
        <div className="no-print bg-sand">
          <div className="mx-auto max-w-4xl px-4 py-2">
            <Nav items={nav} label={t.nav.label} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
      <footer className="no-print border-t-2 border-line bg-sand text-sm">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li><Link className="inline-flex min-h-10 items-center underline" href="/students/privacy">{t.footer.privacy}</Link></li>
            <li><Link className="inline-flex min-h-10 items-center underline" href="/students/report">{t.footer.report}</Link></li>
            <li><Link className="inline-flex min-h-10 items-center underline" href="/residents" lang="he">{t.footer.residents}</Link></li>
          </ul>
          <PartnersStrip locale="en" place="footer" className="mt-6 rounded-2xl bg-white p-4" />
          {/* the wording is a placeholder, to be confirmed with the organisation (config/brand.ts) */}
          <p className="mt-4 text-center">{BRAND.disclaimer.en}</p>
        </div>
      </footer>
    </>
  );
}
