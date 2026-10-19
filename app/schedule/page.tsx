import type { Metadata } from "next";
import Link from "next/link";
import { events, formatEventDate, getProject } from "@/lib/data";

export const metadata: Metadata = { title: "לוח פעילויות – אחוזת צהלה" };

export default function SchedulePage() {
  const dated = events.filter((e) => e.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = events.filter((e) => !e.date);

  return (
    <>
      <h1>לוח פעילויות</h1>
      <p className="lead">אירועים שמסומנים ״טרם אושר״ עדיין בתכנון, והפרטים עשויים להשתנות.</p>

      <ul className="cards">
        {[...dated, ...undated].map((e) => {
          const project = getProject(e.projectSlug);
          return (
            <li key={e.id} className="card">
              <h3>
                {e.title}
                {e.tentative && <span className="badge">טרם אושר</span>}
              </h3>
              <p className="meta">
                {formatEventDate(e)}
                {e.time && ` · ${e.time}`}
                {project && ` · ${project.name}`}
              </p>
              {e.description && <p>{e.description}</p>}
              <Link href={`/signup/event?event=${e.id}`} className="button">
                הרשמה
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
