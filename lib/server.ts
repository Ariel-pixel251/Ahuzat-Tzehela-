import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { deploymentEnv, readEnv } from "@/lib/env";
import { getDb } from "@/lib/db/client";
import { hitRateLimit } from "@/lib/db/misc";
import { DbNotConfiguredError, type Db } from "@/lib/db/types";
import { shared, type Locale } from "@/lib/i18n";
import type { ActionState } from "@/lib/form";
import { logError } from "@/lib/log";
import { isBot, type FieldErrors } from "@/lib/validation";

export type { ActionState } from "@/lib/form";

/** Absolute site URL for links in emails. */
export async function getBaseUrl() {
  // a preview deployment links to itself, so sign-in links work there (its cookies live on its own address)
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const siteUrl = readEnv("SITE_URL");
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  // never build emailed links from request headers in production (they can be spoofed)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * A keyed hash of the client's address for rate limiting (never stored in clear, and not
 * reversible without the server's secret). IPv6 addresses count per /64 network, since one
 * device often controls a whole /64. On Vercel the platform sets these headers itself.
 */
export async function clientKey() {
  const h = await headers();
  let ip = h.get("x-real-ip")?.trim() || (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (ip.includes(":")) ip = ip.split(":").slice(0, 4).join(":") + "::/64";
  const secret = readEnv("RATE_LIMIT_SECRET") || readEnv("CRON_SECRET") || "local-development";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/** Rate limit per client: `max` submissions of `action` per `windowSeconds`. */
export async function allowed(db: Db, action: string, max = 10, windowSeconds = 600) {
  return hitRateLimit(db, `${action}:${await clientKey()}`, max, windowSeconds);
}

export function localizeErrors(errors: FieldErrors, locale: Locale) {
  const text = shared(locale).errors;
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, text[v]]));
}

/** A failed validation as a form result; an error on the form as a whole becomes its message. */
export function invalid(errors: FieldErrors, locale: Locale): ActionState {
  const localized = localizeErrors(errors, locale);
  return { ok: false, errors: localized, message: localized._ ?? undefined };
}

/**
 * Honeypot and rate limit for a public form. Returns a state to stop with, or null to go on.
 * Bots get a normal-looking answer and nothing is saved.
 */
export async function guardForm(
  db: Db,
  fd: FormData,
  action: string,
  locale: Locale,
  { max = 10, windowSeconds = 600, perDay }: { max?: number; windowSeconds?: number; perDay?: number } = {},
): Promise<ActionState> {
  if (isBot(fd)) return { ok: true, code: locale === "he" ? "0000" : undefined };
  if (!(await allowed(db, action, max, windowSeconds))) return { ok: false, message: shared(locale).errors.rateLimited };
  // a daily cap too, so one address can't fill an event or the slots with made-up sign-ups
  if (perDay && !(await allowed(db, `${action}:day`, perDay, 86_400))) return { ok: false, message: shared(locale).errors.rateLimited };
  return null;
}

/** Runs an action with the database, turning failures into friendly messages. */
export async function withDb(locale: Locale, fn: (db: Db) => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn(await getDb());
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      console.error(
        `[db] DATABASE_URL is not set for this deployment (${deploymentEnv()}). Add it in Vercel → Settings → Environment Variables, then redeploy. See /admin/setup.`,
      );
      return { ok: false, message: shared(locale).errors.unavailable };
    }
    // redirect() and notFound() work by throwing; let them through
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("action", err);
    return { ok: false, message: shared(locale).errors.generic };
  }
}

/** Database for server components; null when it isn't configured (pages show a notice instead). */
export async function tryDb(): Promise<Db | null> {
  try {
    return await getDb();
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return null;
    throw err;
  }
}
