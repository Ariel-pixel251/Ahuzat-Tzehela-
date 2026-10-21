// Option lists for the podcast, digital-support and student forms. Edit freely;
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
  { code: "banking", en: "Online banking", he: "בנקאות" },
  { code: "other", en: "Something else", he: "אחר" },
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

/** Times on the "from"/"until" wheels: every half hour from 08:00 to 20:00. Edit the range here. */
export const TIMES: string[] = Array.from({ length: 25 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

/** Stored instead of a time range when the person would rather arrange the time by message. */
export const ARRANGE_BY_MESSAGE = "contact";

export const DEFAULT_TIME_RANGE = "10:00-12:00";

/** A time range code: "10:00-12:30" (both on the wheels, from before until). */
export function parseTimeRange(code: string): { from: string; until: string } | null {
  const m = /^(\d\d:\d\d)-(\d\d:\d\d)$/.exec(code);
  if (!m || !TIMES.includes(m[1]) || !TIMES.includes(m[2]) || m[1] >= m[2]) return null;
  return { from: m[1], until: m[2] };
}

export const isTimeChoice = (code: string) => code === ARRANGE_BY_MESSAGE || parseTimeRange(code) !== null;

// requests saved before time ranges existed
const LEGACY_DAY_PARTS: Option[] = [
  { code: "morning", en: "Morning", he: "בוקר" },
  { code: "afternoon", en: "Afternoon", he: "אחר הצהריים" },
];

const ARRANGE_LABEL = { en: "Arrange the time by message", he: "נתאם שעה בהודעה" };

/** Stored times for people to read: ["10:00-12:30"] → "10:00–12:30"; "contact" → "Arrange the time by message". */
export function formatHours(codes: readonly string[], locale: "en" | "he"): string {
  return [...new Set(codes)]
    .map((c) => {
      if (c === ARRANGE_BY_MESSAGE) return ARRANGE_LABEL[locale];
      const range = parseTimeRange(c);
      return range ? `${range.from}–${range.until}` : optionLabel(LEGACY_DAY_PARTS, c, locale);
    })
    .join(", ");
}

/** Asked on the student profile; under 18 needs a parent or guardian's details and okay. */
export const AGE_GROUPS = [
  { code: "under-18", en: "Under 18", he: "מתחת לגיל 18" },
  { code: "18-plus", en: "18 or older", he: "18 ומעלה" },
] as const;

export function optionLabel(list: readonly Option[], code: string, locale: "en" | "he") {
  return list.find((o) => o.code === code)?.[locale] ?? code;
}

export function validCodes(list: readonly Option[], codes: string[]) {
  const allowed = new Set(list.map((o) => o.code));
  return [...new Set(codes)].filter((c) => allowed.has(c));
}
