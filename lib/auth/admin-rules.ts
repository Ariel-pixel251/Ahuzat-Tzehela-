import { parseEmailList, readEnv } from "@/lib/env";

// Who is an admin, and for how long a sign-in lasts. Shared by the pages, actions and the proxy.

/** Admins (and leaders) are the emails listed in ADMIN_EMAILS, signed in with a Supabase magic link. */
export function adminEmails(): string[] {
  return parseEmailList(readEnv("ADMIN_EMAILS"));
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase());
}

/** An admin session ends this long after signing in (then a new magic link is needed). */
export const ADMIN_SESSION_HOURS = 12;

/** True while a sign-in time is recent enough. */
export function adminSessionFresh(lastSignInAt: string | null | undefined, now = Date.now()) {
  const at = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  return Number.isFinite(at) && now - at < ADMIN_SESSION_HOURS * 3600_000;
}

