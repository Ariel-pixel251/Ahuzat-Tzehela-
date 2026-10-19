import { getSetting, setSetting } from "@/lib/db/misc";
import type { Db } from "@/lib/db/types";

const KEY = "admin_email_last_failure";

export type AdminEmailFailure = { at: string; reason: string };

/** Turns Supabase's error into a plain reason (without saying which email it was for). */
export function adminEmailReason(message: string): string {
  if (/rate limit|too many/i.test(message)) {
    return "Supabase's email limit was reached (its built-in email service sends only a few emails per hour). Wait an hour, or set up custom SMTP in Supabase.";
  }
  if (/not authorized|not allowed to send/i.test(message)) {
    return "Supabase's built-in email only sends to members of your Supabase organisation. Sign in to Supabase with the admin email, or set up custom SMTP in Supabase.";
  }
  if (/signups? not allowed|sign ?ups? (are )?disabled/i.test(message)) {
    return "New sign-ups are disabled in Supabase, so a first-time admin can't get a link. Allow sign-ups in Supabase → Authentication.";
  }
  if (/redirect/i.test(message)) {
    return "Supabase didn't accept the return address. Add https://<your site>/admin/auth/callback to Supabase → Authentication → URL Configuration → Redirect URLs.";
  }
  return "Supabase refused to send it. The exact reason is in Vercel → Logs (search for \"magic link failed\").";
}

export async function recordAdminEmailFailure(db: Db, message: string) {
  await setSetting(db, KEY, { at: new Date().toISOString(), reason: adminEmailReason(message) } satisfies AdminEmailFailure);
}

export async function clearAdminEmailFailure(db: Db) {
  await setSetting(db, KEY, null);
}

export async function lastAdminEmailFailure(db: Db) {
  return getSetting<AdminEmailFailure | null>(db, KEY, null);
}
