import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { PartnerLogo, PartnersStrip } from "@/components/Logos";
import { BackHome } from "@/components/residents/BackHome";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import { BRAND } from "@/config/brand";
import { LOGO_SPACING } from "@/config/logos";
import { residentsText as t } from "@/lib/i18n";

/**
 * Resident portal frame (not sticky, so nothing ever covers the page): "ביחד לדורות, סניף EMIS"
 * linking home, the Ahuzat Tzahala emblem at the end; back home and bigger text on every page.
 * Footer: the partners, the disclaimer and the links. No menus.
 */
export default function ResidentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b-2 border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4" style={{ paddingBlock: LOGO_SPACING.headerPadding }}>
          <BrandLockup locale="he" variant="header" href="/residents" priority />
          <PartnerLogo name="ahuzat" place="header" locale="he" priority />
        </div>
        <div className="no-print border-t-2 border-sand bg-sand">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
            <BackHome label={t.backHome} />
            <TextSizeToggle label={t.textBigger} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>
      <footer className="no-print border-t-2 border-line bg-sand">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <nav aria-label={t.footer.label}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xl">
              {[
                { href: "/residents/status", label: t.footer.status },
                { href: "/residents/report", label: t.footer.report },
                { href: "/residents/privacy", label: t.footer.privacy },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-14 items-center font-bold text-brand underline underline-offset-4">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <PartnersStrip locale="he" place="footer" className="mt-6 rounded-2xl bg-white p-4" />
          {/* the wording is a placeholder, to be confirmed with the organisation (config/brand.ts) */}
          <p className="mt-4 text-center">{BRAND.disclaimer.he}</p>
        </div>
      </footer>
    </>
  );
}
