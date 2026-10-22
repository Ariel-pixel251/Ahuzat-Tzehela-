import Link from "next/link";
import { Logo } from "@/components/Logos";
import { BRAND } from "@/config/brand";

/**
 * Landing page: the partners' logos (EMIS × Ahuzat Tzahala) and the project's name, the program's
 * logo ("ביחד לדורות") below, then two big doors. The Hebrew parts are marked up as Hebrew, right to left.
 */
export default function Landing() {
  return (
    <main id="main" className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 bg-paper px-4 py-10">
      <header lang="he" dir="rtl" className="text-center">
        {/* the two partners side by side, in reading order of the name ("EMIS × אחוזת צהלה") */}
        <div dir="ltr" className="flex items-center justify-center gap-4 sm:gap-6">
          <Logo name="emis" place="landing" locale="he" priority />
          <span aria-hidden="true" className="text-3xl font-black text-muted">×</span>
          <Logo name="ahuzat" place="landing" locale="he" priority />
        </div>
        <h1 className="mt-6 text-[2.6rem] font-black leading-tight tracking-tight sm:text-5xl">
          {BRAND.he}
        </h1>
        <div className="mt-5 flex justify-center">
          <Logo name="beyachad" place="landing" locale="he" priority />
        </div>
        <p className="mt-4 text-xl font-bold">{BRAND.subtitle.he}</p>
        <p lang="en" dir="ltr" className="mt-1 text-lg">{BRAND.subtitle.en}</p>
      </header>
      <Link
        href="/students"
        className="flex min-h-[96px] items-center justify-center rounded-2xl border-4 border-brand bg-brand px-6 text-center text-2xl font-extrabold text-white hover:bg-brand-dark"
      >
        I&apos;m an EMIS student
      </Link>
      <Link
        href="/residents"
        lang="he"
        dir="rtl"
        className="flex min-h-[96px] items-center justify-center rounded-2xl border-4 border-ink bg-white px-6 text-center text-3xl font-extrabold text-ink hover:bg-sand"
      >
        אני דייר/ת באחוזת צהלה
      </Link>
    </main>
  );
}
