// The list of languages used in every language dropdown on the site.
// To add or remove a language, edit this list. `code` is stored in the database,
// so don't change the code of a language that people have already chosen.
export const LANGUAGES = [
  { code: "en", en: "English", he: "אנגלית" },
  { code: "he", en: "Hebrew", he: "עברית" },
  { code: "ar", en: "Arabic", he: "ערבית" },
  { code: "ru", en: "Russian", he: "רוסית" },
  { code: "am", en: "Amharic", he: "אמהרית" },
  { code: "es", en: "Spanish", he: "ספרדית" },
  { code: "fr", en: "French", he: "צרפתית" },
  { code: "de", en: "German", he: "גרמנית" },
  { code: "ro", en: "Romanian", he: "רומנית" },
  { code: "yi", en: "Yiddish", he: "יידיש" },
  { code: "hi", en: "Hindi", he: "הינדי" },
  { code: "zh", en: "Mandarin", he: "סינית" },
  { code: "other", en: "Other", he: "אחר" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const CODES = new Set<string>(LANGUAGES.map((l) => l.code));

export function isLanguageCode(code: string): code is LanguageCode {
  return CODES.has(code);
}

export function languageName(code: string | null | undefined, locale: "en" | "he"): string {
  return LANGUAGES.find((l) => l.code === code)?.[locale] ?? code ?? "";
}
