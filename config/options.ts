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

/** Chosen instead of one of the team's podcast times: "send me a message and we'll arrange it". */
export const ARRANGE_BY_MESSAGE = "contact";

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
