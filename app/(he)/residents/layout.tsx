import Link from "next/link";
import { Announcements } from "@/components/Announcements";
import { CallIcon } from "@/components/icons";
import { BackHome } from "@/components/residents/BackHome";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import { buttonClass } from "@/components/ui";
import { residentsText as t } from "@/lib/i18n";

/** Resident portal frame: back home, bigger text, and "call me back" on every page. No menus. */
// the announcement banner comes from the database: refresh static pages every 5 minutes
export const revalidate = 300;

export default function ResidentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="no-print border-b-2 border-line bg-sand">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <BackHome label={t.backHome} />
          <TextSizeToggle label={t.textBigger} />
          <Link href="/residents/callback" className={`${buttonClass.primary} ms-auto min-h-14`}>
            <CallIcon className="size-7" />
            {t.callMe}
          </Link>
        </div>
      </header>
      <Announcements locale="he" label={t.announcement} />
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>
    </>
  );
}
