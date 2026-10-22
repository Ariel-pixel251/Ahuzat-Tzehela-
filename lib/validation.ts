import { z } from "zod";
import { isLanguageCode } from "@/config/languages";
import { ARRANGE_BY_MESSAGE } from "@/config/options";
import { shared, type Shared } from "@/lib/i18n/en";
import { HONEYPOT } from "@/lib/form";
import { normalizePhone } from "@/lib/phone";

// Every form and URL value is checked here on the server: types, lengths, allowed characters,
// lists of allowed choices, normalised phone numbers, valid emails and UUIDs. Form schemas are
// strict: a field the form doesn't have is rejected.

/** Validation messages are keys into the shared error text, so each portal shows its own language. */
export type ErrorKey = keyof Shared["errors"];

const PHONE_ERRORS = { empty: "phoneEmpty", short: "phoneShort", long: "phoneLong", invalid: "phoneInvalid" } as const;

// control characters (except line breaks in multi-line text), and Unicode direction overrides
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f‪-‮⁦-⁩]/g;
const LINE_BREAKS = /[\r\n\u2028\u2029]+/g;

/** Free text: control characters removed, spaces tidied, trimmed. */
export function cleanText(s: string, { multiline = false } = {}) {
  let out = s.replace(CONTROL, "");
  out = multiline ? out.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") : out.replace(LINE_BREAKS, " ");
  return out.replace(/[ \t]+/g, " ").trim();
}

// letters of any language, combining marks, spaces and the punctuation found in names
const NAME = /^[\p{L}\p{M}][\p{L}\p{M}\s'’`׳״".\-()]*$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const isRealDate = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

const text = (max: number, multiline = false) =>
  z
    .string()
    .transform((s) => cleanText(s, { multiline }))
    .pipe(z.string().max(max, "text"));

const parsePhone = (s: string | undefined, international: boolean, ctx: z.RefinementCtx) => {
  const r = normalizePhone(s ?? "", { international });
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: PHONE_ERRORS[r.reason] });
    return z.NEVER;
  }
  return r.value;
};

export const v = {
  name: z
    .string()
    .transform((s) => cleanText(s))
    .pipe(z.string().min(1, "name").max(100, "name").regex(NAME, "name")),
  text: (max: number, { multiline = false } = {}) => text(max, multiline).pipe(z.string().min(1, "text")),
  optionalText: (max: number, { multiline = false } = {}) =>
    text(max, multiline)
      .optional()
      .transform((s) => s || null),
  email: z
    .string()
    .transform((s) => cleanText(s).toLowerCase())
    .pipe(z.string().min(1, "emailRequired").max(200, "emailInvalid").pipe(z.email("emailInvalid"))),
  optionalEmail: z
    .string()
    .optional()
    .transform((s) => cleanText(s ?? "").toLowerCase() || null)
    .refine((s) => s === null || (s.length <= 200 && z.email().safeParse(s).success), "emailInvalid"),
  phone: ({ international = false } = {}) =>
    z
      .string()
      .optional()
      .transform((s, ctx): string => parsePhone(s, international, ctx)),
  optionalPhone: ({ international = false } = {}) =>
    z
      .string()
      .optional()
      .transform((s, ctx): string | null => (s?.trim() ? parsePhone(s, international, ctx) : null)),
  language: z.string().refine(isLanguageCode, "choose"),
  optionalLanguage: z
    .string()
    .optional()
    .transform((s) => (s && s !== "none" ? s : null))
    .refine((s) => s === null || isLanguageCode(s), "choose"),
  /** A list of codes from an allowed list; unknown codes are an error, not silently dropped. */
  codes: (allowed: readonly { code: string }[], { min = 0, max = 30 } = {}) =>
    z
      .array(z.string().max(60, "choose"))
      .max(max, "choose")
      .default([])
      .refine((list) => list.every((c) => allowed.some((a) => a.code === c)), "choose")
      .transform((list) => [...new Set(list)])
      .refine((list) => list.length >= min, "choose"),
  choice: <T extends string>(allowed: readonly T[]) => z.string().refine((s): s is T => allowed.includes(s as T), "choose"),
  int: (min: number, max: number) =>
    z
      .string()
      .regex(/^\d{1,6}$/, "choose")
      .transform(Number)
      .pipe(z.number().int().min(min, "choose").max(max, "choose")),
  optionalInt: (min: number, max: number) =>
    z
      .string()
      .optional()
      .transform((s) => (s?.trim() ? s.trim() : null))
      .refine((s) => s === null || (/^\d{1,6}$/.test(s) && Number(s) >= min && Number(s) <= max), "choose")
      .transform((s) => (s === null ? null : Number(s))),
  uuid: z.string().regex(UUID, "choose"),
  optionalUuid: z
    .string()
    .optional()
    .transform((s) => s || null)
    .refine((s) => s === null || UUID.test(s), "choose"),
  token: z.string().regex(TOKEN, "text"),
  date: z.string().refine(isRealDate, "text"),
  optionalDate: z
    .string()
    .optional()
    .transform((s) => s || null)
    .refine((s) => s === null || isRealDate(s), "text"),
  time: z.string().regex(TIME, "text"),
  optionalTime: z
    .string()
    .optional()
    .transform((s) => s || null)
    .refine((s) => s === null || TIME.test(s), "text"),
  /** An existing record's id, or "new" (a person typed in on the same form). */
  uuidOrNew: z.string().refine((s) => s === "new" || UUID.test(s), "choose"),
  checkbox: z
    .string()
    .optional()
    .transform((s) => s === "on"),
  /** One of the team's podcast times (its id), or "contact" (arrange by message) → null. */
  podcastTime: z
    .string()
    .trim()
    .refine((s) => s === ARRANGE_BY_MESSAGE || UUID.test(s), "choose")
    .transform((s) => (s === ARRANGE_BY_MESSAGE ? null : s)),
  consent: z.literal("on", { message: "consent" }),
  /** A calendar event key (iCal UID, maybe with "::date"): printable characters only. */
  eventKey: z.string().min(1, "choose").max(600, "choose").regex(/^[\x21-\x7e]+$/, "choose"),
};

/** A form schema: unknown fields are rejected. */
export const form = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);

export type FieldErrors = Record<string, ErrorKey>;

export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
): { ok: true; data: z.output<T> } | { ok: false; errors: FieldErrors } {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    // an unknown field: report it on the form as a whole
    const field = issue.code === "unrecognized_keys" ? "_" : String(issue.path[0] ?? "_");
    // zod's own messages (e.g. a missing field) aren't keys; show "please choose" for those
    if (!errors[field]) errors[field] = (issue.message in shared.errors ? issue.message : "choose") as ErrorKey;
  }
  return { ok: false, errors };
}

/** FormData → plain object, without the honeypot and Next.js's own fields; `arrays` lists multi-value fields. */
export function formObject(fd: FormData, arrays: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION") || key === HONEYPOT) continue;
    out[key] = arrays.includes(key) ? fd.getAll(key).map(String) : String(fd.get(key) ?? "");
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

export function isBot(fd: FormData) {
  return Boolean(String(fd.get(HONEYPOT) ?? "").trim());
}
