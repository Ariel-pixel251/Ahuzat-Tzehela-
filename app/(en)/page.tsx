import Link from "next/link";

/** Landing page: two big doors. The Hebrew button is marked up as Hebrew, right to left. */
export default function Landing() {
  return (
    <main id="main" className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-center text-3xl font-extrabold">
        Ahuzat Tzahala <span aria-hidden="true">·</span>{" "}
        <span lang="he" dir="rtl">
          אמיס - אחוזת צהלה - ביחד לדורות
        </span>
      </h1>
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
        אני דייר/ת
      </Link>
      <p className="text-center">
        <Link href="/students/visit" className="font-bold text-brand underline underline-offset-4">
          Organisations: request a visit
        </Link>
      </p>
    </main>
  );
}
