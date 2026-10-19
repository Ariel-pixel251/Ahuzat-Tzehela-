import { listCourses, listSlots } from "@/lib/db/misc";
import type { Locale } from "@/lib/i18n";
import { tryDb } from "@/lib/server";

const DAY_NAMES = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
};

/** Courses and weekly timetable, edited by admins in the database. */
export async function CoursesView({ locale, text }: { locale: Locale; text: { courses: string; timetable: string; none: string } }) {
  const db = await tryDb();
  const [courses, slots] = db ? await Promise.all([listCourses(db), listSlots(db)]) : [[], []];
  const big = locale === "he";
  return (
    <>
      <h2 className={`mt-8 font-extrabold ${big ? "text-3xl" : "text-2xl"}`}>{text.courses}</h2>
      {courses.length === 0 ? (
        <p className="mt-2">{text.none}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {courses.map((c) => (
            <li key={c.id} className="rounded-2xl border-2 border-line p-5">
              <h3 className={`font-bold ${big ? "text-2xl" : "text-xl"}`}>{locale === "he" ? c.title_he : c.title_en}</h3>
              {(locale === "he" ? c.description_he : c.description_en) && (
                <p className="mt-1">{locale === "he" ? c.description_he : c.description_en}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2 className={`mt-10 font-extrabold ${big ? "text-3xl" : "text-2xl"}`}>{text.timetable}</h2>
      {slots.length === 0 ? (
        <p className="mt-2">{text.none}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {slots.map((s) => (
            <li key={s.id} className="rounded-2xl border-2 border-line p-4">
              <p className="font-bold">
                {DAY_NAMES[locale][s.day]} · <span dir="ltr">{s.start_time}{s.end_time ? `–${s.end_time}` : ""}</span>
              </p>
              <p className={big ? "text-2xl" : "text-lg"}>{locale === "he" ? s.title_he : s.title_en}</p>
              {(locale === "he" ? s.location_he : s.location_en) && <p>{locale === "he" ? s.location_he : s.location_en}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
