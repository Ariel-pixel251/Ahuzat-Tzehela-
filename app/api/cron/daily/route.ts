import { NextResponse, type NextRequest } from "next/server";
import { getCalendar } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import { sendReminders } from "@/lib/domain";

export const dynamic = "force-dynamic";

/**
 * Daily job (Vercel Cron, see vercel.json): reminders for tomorrow's events, then the data
 * retention clean-up. Vercel sends "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = await getDb();
  const reminders = await sendReminders(db, await getCalendar());
  await db.query("select purge_old_data()");
  return NextResponse.json({ reminders });
}
