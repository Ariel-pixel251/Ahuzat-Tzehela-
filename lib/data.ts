// תוכן האתר. המקור: notes/meeting-notes.md

export type Project = {
  slug: string;
  name: string;
  description: string;
};

export const projects: Project[] = [
  {
    slug: "podcast",
    name: "פודקאסט",
    description: "מקליטים יחד עם דיירי האחוזה שיחות, סיפורים וזיכרונות.",
  },
  {
    slug: "games",
    name: "ערב משחקים",
    description: "ערבי משחקי קופסה משותפים לתלמידים ולדיירים.",
  },
  {
    slug: "digital",
    name: "ליווי דיגיטלי",
    description: "עזרה אישית לדיירים בטלפון, במחשב ובאפליקציות.",
  },
  {
    slug: "languages",
    name: "ערב שפות",
    description: "מפגש לתרגול שפות ושיחה בין הדורות.",
  },
];

export type ScheduleEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD; null כשהתאריך עוד לא נקבע */
  date: string | null;
  endDate?: string;
  time?: string;
  description?: string;
  projectSlug?: string;
  /** true כשהפרטים עוד לא סופיים */
  tentative?: boolean;
};

export const events: ScheduleEvent[] = [
  {
    id: "board-games-2026-11-01",
    title: "ערב משחקי קופסה",
    date: "2026-11-01",
    time: "17:30",
    projectSlug: "games",
  },
  {
    id: "languages-2026-11-16",
    title: "ערב שפות",
    date: "2026-11-16",
    time: "18:30",
    projectSlug: "languages",
  },
  {
    id: "hanukkah-2026-12-10",
    title: "מסיבת חנוכה והדלקת נרות",
    date: "2026-12-10",
  },
  {
    id: "guests-2026-12-14",
    title: "ימי פעילות עם אורחים",
    date: "2026-12-14",
    endDate: "2026-12-15",
    description: "ייתכן שאורחים יצטרפו לחלק מהלו״ז. פרטים יעודכנו.",
    tentative: true,
  },
  {
    id: "lecture-2026-12-15",
    title: "הרצאת אורח",
    date: "2026-12-15",
    description: "שם ההרצאה והמרצה יפורסמו בהמשך.",
    tentative: true,
  },
  {
    id: "holocaust-day-2027-01-27",
    title: "יום השואה הבינלאומי – זיכרון בסלון עם הדיירים",
    date: "2027-01-27",
    description: "ייתכן שתתקיים גם הרצאה באנגלית. פרטים יעודכנו.",
  },
  {
    id: "visit-day",
    title: "לבוא לראות יום באחוזה",
    date: null,
    description: "ביקור היכרות באחוזה. התאריך יתואם מול הנרשמים.",
  },
];

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function toUtcDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

export function formatEventDate(event: ScheduleEvent): string {
  if (!event.date) return "התאריך ייקבע בהמשך";
  if (event.endDate) {
    return `${shortDateFormatter.format(toUtcDate(event.date))} – ${dateFormatter.format(toUtcDate(event.endDate))}`;
  }
  return dateFormatter.format(toUtcDate(event.date));
}

export function getProject(slug: string | undefined) {
  return projects.find((p) => p.slug === slug);
}

export function getEvent(id: string | undefined) {
  return events.find((e) => e.id === id);
}
