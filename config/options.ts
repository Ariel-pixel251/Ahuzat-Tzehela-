// Option lists for the podcast and digital-support forms. Edit freely;
// `code` is what gets stored in the database.

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

export const DAY_PARTS = [
  { code: "morning", en: "Morning", he: "בוקר" },
  { code: "afternoon", en: "Afternoon", he: "אחר הצהריים" },
] as const;

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

export type Option = { code: string; en: string; he: string };

export function optionLabel(list: readonly Option[], code: string, locale: "en" | "he") {
  return list.find((o) => o.code === code)?.[locale] ?? code;
}

export function validCodes(list: readonly Option[], codes: string[]) {
  const allowed = new Set(list.map((o) => o.code));
  return [...new Set(codes)].filter((c) => allowed.has(c));
}
