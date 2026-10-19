import { z } from "zod";
import { isLanguageCode } from "@/config/languages";
import { shared, type Shared } from "@/lib/i18n/en";
import { HONEYPOT } from "@/lib/form";
import { normalizePhone } from "@/lib/phone";

/** Validation messages are keys into the shared error text, so each portal shows its own language. */
export type ErrorKey = keyof Shared["errors"];

const PHONE_ERRORS = { empty: "phoneEmpty", short: "phoneShort", long: "phoneLong", invalid: "phoneInvalid" } as const;

const trimmed = (max: number) => z.string().trim().max(max, "text");

export const v = {
  name: z.string().trim().min(1, "name").max(100, "name"),
  text: (max: number) => trimmed(max).min(1, "text"),
  optionalText: (max: number) =>
    trimmed(max)
      .optional()
      .transform((s) => s || null),
  email: z.string().trim().min(1, "emailRequired").max(200, "emailInvalid").email("emailInvalid"),
  optionalEmail: z
    .string()
    .trim()
    .max(200, "emailInvalid")
    .optional()
    .transform((s) => s || null)
    .refine((s) => s === null || z.email().safeParse(s).success, "emailInvalid"),
  phone: ({ international = false } = {}) =>
    z
      .string()
      .optional()
      .transform((s, ctx) => {
        const r = normalizePhone(s ?? "", { international });
        if (!r.ok) {
          ctx.addIssue({ code: "custom", message: PHONE_ERRORS[r.reason] });
          return z.NEVER;
        }
        return r.value;
      }),
  optionalPhone: ({ international = false } = {}) =>
    z
      .string()
      .optional()
      .transform((s, ctx) => {
        if (!s?.trim()) return null;
        const r = normalizePhone(s, { international });
        if (!r.ok) {
          ctx.addIssue({ code: "custom", message: PHONE_ERRORS[r.reason] });
          return z.NEVER;
        }
        return r.value;
      }),
  language: z.string().refine(isLanguageCode, "choose"),
  optionalLanguage: z
    .string()
    .optional()
    .transform((s) => (s && s !== "none" ? s : null))
    .refine((s) => s === null || isLanguageCode(s), "choose"),
  codes: (allowed: readonly { code: string }[], { min = 0 } = {}) =>
    z
      .array(z.string())
      .default([])
      .transform((list) => [...new Set(list)].filter((c) => allowed.some((a) => a.code === c)))
      .refine((list) => list.length >= min, "choose"),
  choice: <T extends string>(allowed: readonly T[]) => z.string().refine((s): s is T => allowed.includes(s as T), "choose"),
  int: (min: number, max: number) => z.coerce.number().int().min(min, "choose").max(max, "choose"),
  consent: z.literal("on", { message: "consent" }),
};

export type FieldErrors = Record<string, ErrorKey>;

export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
): { ok: true; data: z.output<T> } | { ok: false; errors: FieldErrors } {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const field = String(issue.path[0] ?? "_");
    // zod's own messages (e.g. a missing field) aren't keys; show "please choose" for those
    if (!errors[field]) errors[field] = (issue.message in shared.errors ? issue.message : "choose") as ErrorKey;
  }
  return { ok: false, errors };
}

/** FormData → plain object; `arrays` lists the multi-value fields. */
export function formObject(fd: FormData, arrays: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    out[key] = arrays.includes(key) ? fd.getAll(key).map(String) : String(fd.get(key) ?? "");
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

export function isBot(fd: FormData) {
  return Boolean(String(fd.get(HONEYPOT) ?? "").trim());
}
