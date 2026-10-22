import Link from "next/link";
import { LogoBar } from "@/components/Logos";
import { BackHome } from "@/components/residents/BackHome";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import { residentsText as t } from "@/lib/i18n";

/** Resident portal frame: the logos (linking home), back home and bigger text on every page. No menus. */
export default function ResidentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b-2 border-line">
        <LogoBar place="header" locale="he" href="/residents" label={t.logosHome} priority className="px-4 pt-3 text-center" />
        <div className="no-print bg-sand">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
            <BackHome label={t.backHome} />
            <TextSizeToggle label={t.textBigger} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>
      <footer className="no-print mx-auto max-w-3xl border-t-2 border-line px-4 py-6">
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
        <LogoBar place="footer" locale="he" className="mt-6" />
      </footer>
    </>
  );
}
