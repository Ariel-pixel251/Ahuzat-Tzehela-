import Link from "next/link";
import { events, formatEventDate, projects } from "@/lib/data";

export default function Home() {
  const upcoming = events.filter((e) => e.date).slice(0, 3);

  return (
    <>
      <h1>פעילויות באחוזת צהלה</h1>
      <p className="lead">
        מפגשים בין תלמידים לדיירי האחוזה: פרויקטים, אירועים ושיעורים פרטיים. בחרו במה תרצו להשתתף והירשמו.
      </p>

      <h2>האירועים הקרובים</h2>
      <ul className="cards">
        {upcoming.map((e) => (
          <li key={e.id} className="card">
            <h3>{e.title}</h3>
            <p className="meta">
              {formatEventDate(e)}
              {e.time && ` · ${e.time}`}
            </p>
          </li>
        ))}
      </ul>
      <Link href="/schedule" className="button">
        ללוח המלא
      </Link>

      <h2>הפרויקטים שלנו</h2>
      <ul className="cards two">
        {projects.map((p) => (
          <li key={p.slug}>
            <Link href={`/signup/project?project=${p.slug}`} className="card">
              <h3>{p.name}</h3>
              <p>{p.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
