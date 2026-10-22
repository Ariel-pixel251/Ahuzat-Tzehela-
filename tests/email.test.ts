import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import { emailProvider, sendEmail } from "@/lib/notify";
import { emailHtml } from "@/lib/notify/html";
import { smtpSettings } from "@/lib/notify/smtp";

test("Gmail needs only the address and an app password (spaces removed)", () => {
  const env = (vars: Record<string, string>) => (name: string) => vars[name];
  expect(smtpSettings(env({ SMTP_USER: "ahuzat@gmail.com", SMTP_PASSWORD: "abcd efgh ijkl mnop" }))).toEqual({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    user: "ahuzat@gmail.com",
    pass: "abcdefghijklmnop",
    from: '"ביחד לדורות, סניף EMIS" <ahuzat@gmail.com>',
  });
  expect(smtpSettings(env({ SMTP_USER: "me@example.org", SMTP_PASSWORD: "x" }))).toBeNull(); // other mailboxes need SMTP_HOST
  expect(smtpSettings(env({ SMTP_USER: "me@example.org", SMTP_PASSWORD: "x y", SMTP_HOST: "smtp.example.org", SMTP_PORT: "587" }))).toMatchObject({
    port: 587,
    secure: false,
    pass: "x y",
  });
  expect(smtpSettings(env({}))).toBeNull();
});

// A real email through a local mail server, with the same code the site uses.
const PORT = 2526;
const received: { from: string; to: string[]; data: string; user?: string }[] = [];
let server: SMTPServer;

beforeAll(async () => {
  server = new SMTPServer({
    secure: false,
    disabledCommands: ["STARTTLS"],
    authOptional: false,
    allowInsecureAuth: true,
    onAuth(auth, _session, cb) {
      if (auth.username === "site@example.org" && auth.password === "secret") cb(null, { user: auth.username });
      else cb(new Error("Invalid login"));
    },
    onData(stream, session, cb) {
      let data = "";
      stream.on("data", (c) => (data += c));
      stream.on("end", () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          data,
          user: session.user as string | undefined,
        });
        cb();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(PORT), SMTP_USER: "site@example.org", SMTP_PASSWORD: "secret" });
});

afterAll(async () => {
  for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"]) delete process.env[k];
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("sign-in emails go out through the mailbox", async () => {
  expect(emailProvider()).toBe("smtp");
  expect(await sendEmail("dana@em-is.org", { subject: "Your sign-in link", body: "Hi Dana, https://example.org/x" })).toBe("sent");
  expect(received).toHaveLength(1);
  expect(received[0]).toMatchObject({ from: "site@example.org", to: ["dana@em-is.org"], user: "site@example.org" });
  expect(received[0].data).toContain("Subject: Your sign-in link");
  // plain text and HTML (with the logos) in one email
  expect(received[0].data).toContain("multipart/alternative");
  expect(received[0].data).toContain("text/plain");
  expect(received[0].data).toContain("text/html");
});

test("the HTML email: the logos from the site's own address, alt text in the reader's language, the text escaped", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://beyachad-ledorot.vercel.app/";
  try {
    const he = emailHtml("שלום <b>רבקה</b>\nקישור: https://beyachad-ledorot.vercel.app/residents/manage?token=a&b=c", "he");
    for (const file of ["emis.png", "ahuzat-tzahala.png", "beyachad-ledorot.png"]) {
      expect(he).toContain(`src="https://beyachad-ledorot.vercel.app/logos/email/${file}"`);
    }
    expect(he).toContain('alt="אחוזת צהלה"');
    expect(he).toContain('alt="ביחד לדורות"');
    expect(he).toContain(">סניף EMIS</td>");
    expect(he).toContain('alt="EMIS"');
    expect(he).toContain('dir="rtl"');
    // names can't add HTML; line breaks and links are kept
    expect(he).toContain("&lt;b&gt;רבקה&lt;/b&gt;<br>");
    expect(he).not.toContain("<b>");
    expect(he).toContain('<a href="https://beyachad-ledorot.vercel.app/residents/manage?token=a&amp;b=c"');
    const en = emailHtml("Hi", "en");
    expect(en).toContain('alt="Ahuzat Tzahala"');
    expect(en).toContain('alt="Together for Generations"');
    expect(en).toContain(">EMIS Branch</td>");
    expect(en).toContain('dir="ltr"');
  } finally {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test("a wrong password is reported as failed, not sent", async () => {
  process.env.SMTP_PASSWORD = "wrong";
  expect(await sendEmail("dana@em-is.org", { subject: "x", body: "y" })).toBe("failed");
  process.env.SMTP_PASSWORD = "secret";
});
