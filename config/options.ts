// Option lists for the podcast and digital-support forms. Edit freely;
// `code` is what gets stored in the database.

export type Option = { code: string; en: string; he: string };

export const PODCAST_TOPICS = [
  { code: "life-story", en: "Life stories", he: "סיפורי חיים" },
  { code: "history", en: "History", he: "היסטוריה" },
  { code: "immigration", en: "Immigration and Aliyah", he: "הגירה ועלייה" },
  { code: "family", en: "Family and traditions", he: "משפחה ומסורת" },
  { code: "work", en: "Work and careers", he: "עבודה וקריירה" },
  { code: "music", en: "Music", he: "מוזיקה" },
  { code: "food", en: "Food and cooking", he: "אוכל ובישול" },
  { code: "travel", en: "Travel", he: "טיולים" },
  { code: "technology", en: "Technology", he: "טכנולוגיה" },
  { code: "sports", en: "Sports", he: "ספורט" },
  { code: "art", en: "Art and culture", he: "אמנות ותרבות" },
] as const;

export const DIGITAL_NEEDS = [
  { code: "phone", en: "Phone", he: "טלפון" },
  { code: "whatsapp", en: "WhatsApp", he: "וואטסאפ" },
  { code: "email", en: "Email", he: "אימייל" },
  { code: "banking", en: "Online banking", he: "בנק באינטרנט" },
  { code: "computer", en: "Computer", he: "מחשב" },
  { code: "other", en: "Something else", he: "משהו אחר" },
] as const;

export const PROJECTS = [
  { code: "podcast", en: "Podcast", he: "פודקאסט" },
  { code: "game-night", en: "Game night", he: "ערב משחקים" },
  { code: "digital-support", en: "Digital support", he: "ליווי דיגיטלי" },
  { code: "language-night", en: "Language night", he: "ערב שפות" },
  { code: "other", en: "Other", he: "אחר" },
] as const;

export const DAYS = [
  { code: "sun", en: "Sun", he: "ראשון" },
  { code: "mon", en: "Mon", he: "שני" },
  { code: "tue", en: "Tue", he: "שלישי" },
  { code: "wed", en: "Wed", he: "רביעי" },
  { code: "thu", en: "Thu", he: "חמישי" },
  { code: "fri", en: "Fri", he: "שישי" },
] as const;

/** Hours people can pick (each means that hour, e.g. "10:00" = 10:00–11:00). Edit the range here. */
export const HOURS: Option[] = Array.from({ length: 13 }, (_, i) => {
  const code = `${String(8 + i).padStart(2, "0")}:00`;
  return { code, en: code, he: code };
});

// requests saved before hours existed
const LEGACY_DAY_PARTS: Option[] = [
  { code: "morning", en: "Morning", he: "בוקר" },
  { code: "afternoon", en: "Afternoon", he: "אחר הצהריים" },
];

/** Chosen hours as ranges: ["10:00","11:00","15:00"] → "10:00–12:00, 15:00–16:00". */
export function formatHours(codes: readonly string[], locale: "en" | "he"): string {
  const hours = [...new Set(codes)]
    .map((c) => (/^\d\d:00$/.test(c) ? Number(c.slice(0, 2)) : null))
    .filter((h): h is number => h !== null)
    .sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < hours.length; i++) {
    const start = hours[i];
    while (hours[i + 1] === hours[i] + 1) i++;
    const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
    ranges.push(`${pad(start)}–${pad(hours[i] + 1)}`);
  }
  const legacy = codes.filter((c) => !/^\d\d:00$/.test(c)).map((c) => optionLabel(LEGACY_DAY_PARTS, c, locale));
  return [...ranges, ...legacy].join(", ");
}

export const MEMORIAL_ROLES = {
  resident: [
    { code: "host", en: "Host in my living room", he: "לארח בסלון שלי" },
    { code: "share", en: "Share a memory", he: "לספר זיכרון" },
    { code: "attend", en: "Come and listen", he: "להגיע ולהקשיב" },
  ],
  student: [
    { code: "attend", en: "Attend", he: "להגיע" },
    { code: "help", en: "Help organise", he: "לעזור בארגון" },
  ],
} as const;

export function optionLabel(list: readonly Option[], code: string, locale: "en" | "he") {
  return list.find((o) => o.code === code)?.[locale] ?? code;
}

export function validCodes(list: readonly Option[], codes: string[]) {
  const allowed = new Set(list.map((o) => o.code));
  return [...new Set(codes)].filter((c) => allowed.has(c));
}
