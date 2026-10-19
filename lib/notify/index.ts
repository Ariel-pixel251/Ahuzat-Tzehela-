import { queueMessage } from "@/lib/db/misc";
import { readEnv } from "@/lib/env";
import { smtpSettings } from "./smtp";
import type { Db } from "@/lib/db/types";

export type Message = { subject: string; body: string };
export type Recipient = { name: string; email?: string | null; phone?: string | null; portal: "student" | "resident" };

/** How email is sent: Resend (needs a verified domain), any mailbox over SMTP (e.g. Gmail), or not at all. */
export function emailProvider(): "resend" | "smtp" | null {
  if (readEnv("RESEND_API_KEY") && readEnv("EMAIL_FROM")) return "resend";
  if (smtpSettings()) return "smtp";
  return null;
}

export function emailConfigured() {
  return emailProvider() !== null;
}

type Transport = { sendMail(m: { from: string; to: string; subject: string; text: string }): Promise<unknown>; verify(): Promise<unknown> };
let transport: { key: string; transport: Transport } | undefined;

/** The SMTP connection, reused between emails (rebuilt if the settings change). */
export async function smtpTransport(): Promise<Transport | null> {
  const s = smtpSettings();
  if (!s) return null;
  const key = `${s.host}:${s.port}:${s.user}:${s.pass}`;
  if (transport?.key !== key) {
    const nodemailer = await import("nodemailer");
    transport = {
      key,
      transport: nodemailer.createTransport({
        host: s.host,
        port: s.port,
        secure: s.secure,
        auth: { user: s.user, pass: s.pass },
        connectionTimeout: 10_000,
      }),
    };
  }
  return transport.transport;
}

/** Sends an email. Without an email service it's logged instead (local development). */
export async function sendEmail(to: string, msg: Message): Promise<"sent" | "logged" | "failed"> {
  const provider = emailProvider();
  if (!provider) {
    console.info(`[email] (not sent: no email service set up)\nTo: ${to}\nSubject: ${msg.subject}\n\n${msg.body}\n`);
    return "logged";
  }
  try {
    if (provider === "smtp") {
      await (await smtpTransport())!.sendMail({ from: smtpSettings()!.from, to, subject: msg.subject, text: msg.body });
      return "sent";
    }
    const key = readEnv("RESEND_API_KEY")!;
    const from = readEnv("EMAIL_FROM")!;
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
