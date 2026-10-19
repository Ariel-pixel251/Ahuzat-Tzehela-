import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "הרשמה – אחוזת צהלה" };

const options = [
  { href: "/signup/project", title: "פרויקט או קבוצה", text: "פודקאסט, ערב משחקים, ליווי דיגיטלי או ערב שפות." },
  { href: "/signup/event", title: "אירוע", text: "הרשמה לאירוע מסוים מלוח הפעילויות." },
  { href: "/signup/lesson", title: "שיעור פרטי", text: "רוצים ללמד או ללמוד נושא מסוים? ספרו לנו." },
  { href: "/signup/lecture", title: "הצעת הרצאה", text: "דיירים שרוצים להרצות אצלנו מוזמנים להציע את עצמם." },
];

export default function SignupHub() {
  return (
    <>
      <h1>הרשמה</h1>
      <p className="lead">בחרו למה תרצו להירשם. אפשר להירשם ליותר מדבר אחד.</p>
      <ul className="cards two">
        {options.map((o) => (
          <li key={o.href}>
            <Link href={o.href} className="card">
              <h3>{o.title}</h3>
              <p>{o.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
