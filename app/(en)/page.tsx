import Link from "next/link";
import { BRAND } from "@/config/brand";

/** Landing page: the project's name, then two big doors. The Hebrew parts are marked up as Hebrew, right to left. */
export default function Landing() {
  return (
    <main id="main" className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <header lang="he" dir="rtl" className="text-center">
        <h1 className="text-[2.6rem] font-black leading-tight tracking-tight sm:text-5xl">
          <bdi>{BRAND.he}</bdi>
        </h1>
        <p className="mt-3 text-xl font-bold">{BRAND.subtitle.he}</p>
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
