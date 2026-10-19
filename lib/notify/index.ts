import { queueMessage } from "@/lib/db/misc";
import type { Db } from "@/lib/db/types";

export type Message = { subject: string; body: string };
export type Recipient = { name: string; email?: string | null; phone?: string | null; portal: "student" | "resident" };

/** Sends email through Resend. Without RESEND_API_KEY the email is logged instead (local development). */
export async function sendEmail(to: string, msg: Message): Promise<"sent" | "logged" | "failed"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email] (not sent: RESEND_API_KEY/EMAIL_FROM not set)\nTo: ${to}\nSubject: ${msg.subject}\n\n${msg.body}\n`);
    return "logged";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: msg.subject, text: msg.body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
    return "sent";
  } catch (err) {
    console.error("[email] failed:", err);
    return "failed";
  }
}

/**
 * SMS/WhatsApp provider abstraction. For now messages are queued in the database and sent by
 * hand from /admin/messages. To connect a provider (e.g. Twilio), add one here and pick it
 * with SMS_PROVIDER.
 */
export interface TextMessageProvider {
  send(db: Db, to: { phone: string; name: string | null }, body: string): Promise<void>;
}

const manualQueue: TextMessageProvider = {
  async send(db, to, body) {
    await queueMessage(db, { channel: "sms", to_phone: to.phone, to_name: to.name, body });
  },
};

function textProvider(): TextMessageProvider {
  return manualQueue;
}

/**
 * Residents: a text message (queued for now), plus email if they gave one.
 * Students: email; a text message only if there is no email.
 */
export async function notify(db: Db, to: Recipient, msg: Message) {
  if (to.email) await sendEmail(to.email, msg);
  if (to.phone && (to.portal === "resident" || !to.email)) {
    await textProvider().send(db, { phone: to.phone, name: to.name }, msg.body);
  }
}
