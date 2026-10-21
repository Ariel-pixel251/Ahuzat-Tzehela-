// Fails if anything secret-looking ended up in the files sent to browsers (.next/static).
// Run after `next build`. Optional: set the real secret values in the environment of the CI job
// (they are never printed) and this also checks that their exact values don't appear.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".next", "static");
const PATTERNS = [
  [/service_role/i, "the Supabase service role"],
  [/SUPABASE_SERVICE_ROLE_KEY/, "the service role key's name"],
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "a Supabase secret key"],
  [/postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/i, "a database connection string with a password"],
  [/\bre_[A-Za-z0-9]{20,}\b/, "a Resend API key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
];
const SECRET_ENV = ["SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "SMTP_PASSWORD", "RESEND_API_KEY", "CRON_SECRET"];
const secretValues = SECRET_ENV.map((k) => process.env[k]?.trim()).filter((v) => v && v.length >= 8);

async function* files(dir) {
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    if ((await stat(full)).isDirectory()) yield* files(full);
    else if (/\.(js|css|html|json|map|txt)$/.test(entry)) yield full;
  }
}

let problems = 0;
let count = 0;
try {
  for await (const file of files(ROOT)) {
    count++;
    const text = await readFile(file, "utf8");
    for (const [re, what] of PATTERNS) {
      if (re.test(text)) {
        console.error(`✗ ${path.relative(process.cwd(), file)}: contains ${what}`);
        problems++;
      }
    }
    for (const value of secretValues) {
      if (text.includes(value)) {
        console.error(`✗ ${path.relative(process.cwd(), file)}: contains the value of a secret setting`);
        problems++;
      }
    }
  }
} catch (err) {
  console.error(`Couldn't read ${ROOT}: run "next build" first.`, err.message);
  process.exit(1);
}
if (problems) process.exit(1);
console.log(`✓ No secrets in the ${count} browser files.`);
