import "server-only";
import { adminEmails, supabasePublicKey, supabaseUrl } from "@/lib/auth/admin";
import { getCalendar } from "@/lib/calendar";
import { databaseMode, getDb } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/errors";
import { getSetting } from "@/lib/db/misc";
import { deploymentEnv, readEnv, studentEmailDomains } from "@/lib/env";
import { emailConfigured } from "@/lib/notify";

export type CheckStatus = "ok" | "info" | "warn" | "bad";
export type Check = { name: string; status: CheckStatus; detail: string; fix?: string };

const ADD_VAR = (name: string) =>
  `In Vercel → Settings → Environment Variables, add ${name} with "${deploymentEnv()}" ticked, then Deployments → ⋯ → Redeploy.`;

let cached: { at: number; checks: Promise<Check[]> } | undefined;

/**
 * What works and what's missing on this deployment. Never includes secret values. Results are
 * reused for 30 seconds, since the page is public.
 */
export function setupChecks(): Promise<Check[]> {
  if (!cached || Date.now() - cached.at > 30_000) cached = { at: Date.now(), checks: runChecks() };
  return cached.checks;
}

async function runChecks(): Promise<Check[]> {
  const checks = await Promise.all([checkDatabase(), checkSupabaseAuth(), checkCalendar()]);
  return [
    ...checks[0],
    ...checks[1],
    checkAdminEmails(),
    checkSiteUrl(),
    checkEmail(),
    checkCron(),
    checks[2],
  ];
}

async function checkDatabase(): Promise<Check[]> {
  const mode = databaseMode();
  if (mode === "local") return [{ name: "Database", status: "ok", detail: "Local development database (PGlite)." }];
  if (mode === "missing") {
    return [
      {
        name: "Database",
        status: "bad",
        detail: `DATABASE_URL isn't set for this deployment (${deploymentEnv()}). Every form shows "not available" and admin pages can't open.`,
        fix: ADD_VAR("DATABASE_URL"),
      },
    ];
  }
  let topics: number;
  let m0002: boolean;
  try {
    const db = await getDb();
    // one query proves the connection, the tables (lesson_topics) and the functions (hit_rate_limit)
    const [row] = await db.query<{ topics: number; functions: boolean; m0002: boolean }>(
      `select (select count(*)::int from lesson_topics) as topics,
              to_regproc('public.hit_rate_limit') is not null as functions,
              to_regproc('public.promote_waitlist') is not null as m0002`,
    );
    if (!row.functions) {
      return dbProblem({ code: "42883" });
    }
    topics = row.topics;
    m0002 = row.m0002;
  } catch (err) {
    return dbProblem(err);
  }
  const approval = Boolean(await getSetting(await getDb(), "require_match_approval", false).catch(() => false));
  return [
    m0002
      ? { name: "Database", status: "ok", detail: "Connected, and the tables are set up." }
      : {
          name: "Database update",
          status: "warn",
          detail: "Connected, but the latest database update hasn't been run (waiting lists won't move up automatically).",
          fix: "In Supabase → SQL Editor, run supabase/migrations/0002_promote_waitlist.sql once.",
        },
    studentEmailDomains().length || approval
      ? { name: "Residents' phone numbers", status: "ok", detail: "Protected by school-email sign-in or leader approval." }
      : {
          name: "Residents' phone numbers",
          status: "warn",
          detail: "Anyone with any email can sign in as a student, take a digital-support request and see the resident's phone number.",
          fix: "Add STUDENT_EMAIL_DOMAINS in Vercel (the school's email domain, e.g. emis.org.il) and redeploy, or turn on leader approval in /admin → Digital support.",
        },
    topics > 0
      ? { name: "Starter data", status: "ok", detail: "Lesson topics are set up." }
      : {
          name: "Starter data",
          status: "warn",
          detail: "No lesson topics yet.",
          fix: "In Supabase → SQL Editor, run supabase/seed.sql (or add topics in /admin → Lessons).",
        },
  ];
}

function dbProblem(err: unknown): Check[] {
  const { problem, fix } = describeDbError(err);
  return [{ name: "Database", status: "bad", detail: problem, fix }];
}

async function checkSupabaseAuth(): Promise<Check[]> {
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) {
    return [
      {
        name: "Admin sign-in (Supabase Auth)",
        status: "bad",
        detail: `${!url ? "NEXT_PUBLIC_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"} isn't set, so admin sign-in links can't be sent.`,
        fix: ADD_VAR(!url ? "NEXT_PUBLIC_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      },
    ];
  }
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      return [
        {
          name: "Admin sign-in (Supabase Auth)",
          status: "bad",
          detail: "Supabase rejected the publishable key.",
          fix: "Copy NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY again from Supabase → Connect → Framework (it starts with sb_publishable_), from the same project as NEXT_PUBLIC_SUPABASE_URL.",
        },
      ];
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const settings = (await res.json()) as { disable_signup?: boolean; external?: { email?: boolean } };
    const checks: Check[] = [{ name: "Admin sign-in (Supabase Auth)", status: "ok", detail: "Supabase answered with this project's address and key." }];
    if (settings.external?.email === false) {
      checks.push({
        name: "Email sign-in in Supabase",
        status: "bad",
        detail: "The Email provider is turned off in Supabase, so magic links can't be sent.",
        fix: "Supabase → Authentication → Sign In / Providers → Email: turn it on.",
      });
    }
    if (settings.disable_signup) {
      checks.push({
        name: "New sign-ups in Supabase",
        status: "warn",
        detail: "New users are disabled in Supabase, so an admin who has never signed in can't get a link.",
        fix: "Supabase → Authentication → Sign In / Providers: allow new users to sign up (only emails in ADMIN_EMAILS can open /admin anyway).",
      });
    }
    checks.push({
      name: "Admin email delivery",
      status: "info",
      detail:
        "Unless Supabase uses your own email service, it only sends a few emails per hour, and only to members of your Supabase organisation.",
      fix: "If the email doesn't arrive: check spam; sign in to Supabase with the same email as in ADMIN_EMAILS, or set up custom SMTP (Supabase → Authentication → Emails → SMTP Settings, e.g. Resend). The exact reason is in Vercel → Logs (search \"magic link failed\").",
    });
    return checks;
  } catch {
    return [
      {
        name: "Admin sign-in (Supabase Auth)",
        status: "bad",
        detail: "Couldn't reach Supabase at NEXT_PUBLIC_SUPABASE_URL.",
        fix: "Copy NEXT_PUBLIC_SUPABASE_URL again from Supabase → Connect → Framework (https://….supabase.co).",
      },
    ];
  }
}

function checkAdminEmails(): Check {
  const count = adminEmails().length;
  return count
    ? { name: "Admin emails", status: "ok", detail: "ADMIN_EMAILS is set." }
    : {
        name: "Admin emails",
        status: "bad",
        detail: "ADMIN_EMAILS is empty, so nobody can sign in to /admin (no link is sent).",
        fix: ADD_VAR("ADMIN_EMAILS"),
      };
}

function checkSiteUrl(): Check {
  const url = readEnv("SITE_URL");
  if (url) return { name: "Site address", status: "ok", detail: "SITE_URL is set." };
  return {
    name: "Site address",
    status: process.env.VERCEL_PROJECT_PRODUCTION_URL ? "warn" : "ok",
    detail: process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `SITE_URL isn't set; emails use https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}.`
      : "Not set (fine for local development).",
    fix: process.env.VERCEL_PROJECT_PRODUCTION_URL ? ADD_VAR("SITE_URL") : undefined,
  };
}

function checkEmail(): Check {
  if (emailConfigured()) return { name: "Email to students and residents (Resend)", status: "ok", detail: "RESEND_API_KEY and EMAIL_FROM are set." };
  return {
    name: "Email to students and residents (Resend)",
    status: "warn",
    detail: `${!readEnv("RESEND_API_KEY") ? "RESEND_API_KEY" : "EMAIL_FROM"} isn't set: confirmations aren't emailed, and students can't get sign-in links for digital support.`,
    fix: "Create a Resend account and verified sender, then add RESEND_API_KEY and EMAIL_FROM in Vercel and redeploy.",
  };
}

function checkCron(): Check {
  if (readEnv("CRON_SECRET")) return { name: "Daily reminders", status: "ok", detail: "CRON_SECRET is set." };
  if (process.env.NODE_ENV !== "production") return { name: "Daily reminders", status: "ok", detail: "Not needed locally." };
  return {
    name: "Daily reminders",
    status: "warn",
    detail: "CRON_SECRET isn't set, so the daily reminders and clean-up don't run.",
    fix: ADD_VAR("CRON_SECRET"),
  };
}

async function checkCalendar(): Promise<Check> {
  const calendar = await getCalendar();
  if (calendar.source === "calendar") {
    return { name: "Google Calendar", status: "ok", detail: "The calendar feed is being read." };
  }
  return {
    name: "Google Calendar",
    status: "warn",
    detail: "The calendar feed couldn't be read, so the site shows the offline list without registration buttons.",
    fix: "In Google Calendar, open the calendar's Settings and sharing and tick \"Make available to public\".",
  };
}
