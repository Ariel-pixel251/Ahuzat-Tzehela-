import * as en from "./en";
import * as he from "./he";
import type { Locale } from "./format";

export type { Locale } from "./format";
export type { Shared } from "./en";

export const sharedText = { en: en.shared, he: he.shared };
export const studentsText = en.students;
export const residentsText = he.residents;

export function shared(locale: Locale) {
  return sharedText[locale];
}

/** Picks the portal's language from a bilingual value. */
export function pick(value: { en: string; he: string } | undefined | null, locale: Locale) {
  return value ? value[locale] : "";
}
