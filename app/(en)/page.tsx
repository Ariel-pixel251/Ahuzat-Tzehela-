import Link from "next/link";
import { BrandLockup } from "@/components/BrandLockup";
import { PartnerLogo, PartnersStrip } from "@/components/Logos";
import { BRAND } from "@/config/brand";

const door =
  "flex min-h-[96px] w-full items-center justify-center gap-4 rounded-2xl border-4 bg-white px-5 py-4 text-center font-extrabold text-ink no-underline";

/**
 * Landing page, calm and centred: "ביחד לדורות" with the branch label, the tagline, two equal doors
 * (each with its partner's logo and colour), then the partners, the disclaimer and the privacy links.
 * Bilingual: Hebrew first for the residents, English for the students.
 */
export default function Landing() {
  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
        <header className="flex flex-col items-center gap-4 text-center">
          <h1 className="sr-only">{BRAND.branchName.he} · {BRAND.branchName.en}</h1>
          <BrandLockup locale="he" variant="landing" priority />
          <div className="space-y-1">
            <p lang="he" dir="rtl" className="text-[22px] font-bold text-ink">{BRAND.tagline.he}</p>
            <p lang="en" dir="ltr" className="text-[22px] text-ink">{BRAND.tagline.en}</p>
          </div>
        </header>
        {/* two equal doors: stacked on phones, side by side from 640px */}
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Link href="/residents" lang="he" dir="rtl" className={`${door} border-maroon text-3xl hover:bg-maroon-soft`}>
            <PartnerLogo name="ahuzat" place="door" locale="he" decorative />
            <span>אני דייר/ת באחוזת צהלה</span>
          </Link>
          <Link href="/students" className={`${door} border-emis text-2xl hover:bg-sand`}>
            <PartnerLogo name="emis" place="door" locale="en" decorative />
            <span>I&apos;m an EMIS student</span>
          </Link>
        </div>
      </main>
      <footer className="border-t-2 border-line bg-sand">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-6 text-center">
          <PartnersStrip locale="he" place="partners" bilingual className="w-full rounded-2xl bg-white p-4" />
          {/* the wording is a placeholder, to be confirmed with the organisation (config/brand.ts) */}
          <p lang="he" dir="rtl">{BRAND.disclaimer.he}</p>
          <p lang="en" dir="ltr" className="text-sm">{BRAND.disclaimer.en}</p>
          <p className="flex flex-wrap justify-center gap-x-6">
            <Link href="/residents/privacy" lang="he" className="inline-flex min-h-11 items-center font-bold text-brand underline">פרטיות</Link>
            <Link href="/students/privacy" className="inline-flex min-h-11 items-center font-bold text-brand underline">Privacy notice</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
