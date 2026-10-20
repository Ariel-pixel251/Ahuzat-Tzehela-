import { NextResponse, type NextRequest } from "next/server";
import { getCalendar } from "@/lib/calendar";
import { cronAuthorized } from "@/lib/cron";
import { getDb } from "@/lib/db/client";
import { purgeOldData } from "@/lib/db/misc";
import { readEnv } from "@/lib/env";
import { promoteWaitlists, sendReminders, sendSlotReminders } from "@/lib/domain";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Daily job (Vercel Cron, see vercel.json): reminders for tomorrow's events and digital support
 * slots, waiting-list promotion, then the data retention clean-up.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request.headers.get("authorization"), [process.env.CRON_SECRET, readEnv("CRON_SECRET")])) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = await getDb();
  const calendar = await getCalendar();
  const result: Record<string, unknown> = {};
  // each step runs even if another one fails, so one problem doesn't stop the clean-up
  for (const [name, step] of [
    ["event_reminders", () => sendReminders(db, calendar)],
    ["slot_reminders", () => sendSlotReminders(db)],
    ["promoted", () => promoteWaitlists(db, calendar)],
    ["deleted", () => purgeOldData(db)],
  ] as const) {
    try {
      result[name] = await step();
    } catch (err) {
      logError(`cron ${name}`, err);
      result[name] = "failed";
    }
  }
  return NextResponse.json(result);
}
