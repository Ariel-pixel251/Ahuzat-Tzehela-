import { listActiveAnnouncements } from "@/lib/db/misc";
import type { Locale } from "@/lib/i18n";
import { tryDb } from "@/lib/server";

/** Admin-editable banner. Never breaks the page if the database is unavailable. */
export async function Announcements({ locale, label }: { locale: Locale; label: string }) {
  let items: Awaited<ReturnType<typeof listActiveAnnouncements>> = [];
  try {
    const db = await tryDb();
    if (db) items = await listActiveAnnouncements(db);
  } catch (err) {
    console.error("[announcements]", err);
  }
  if (!items.length) return null;
  return (
    <section aria-label={label} className="no-print border-b-4 border-warn bg-warn-soft">
      {items.map((a) => (
        <p
          key={a.id}
          className={`mx-auto max-w-3xl px-4 py-3 font-bold text-ink ${locale === "he" ? "text-2xl" : "text-lg"}`}
        >
          {locale === "he" ? a.text_he : a.text_en}
        </p>
      ))}
    </section>
  );
}
