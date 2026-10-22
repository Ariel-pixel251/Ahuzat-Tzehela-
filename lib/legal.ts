import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND } from "@/config/brand";

/** The editable legal texts in legal/*.md (drafts for review, see LEGAL_TODO.md). */
const DOCS = { "privacy-residents": "privacy-residents.he.md", "privacy-students": "privacy-students.en.md" } as const;

const EMAIL = /^[^\s@<>()[\]"]+@[^\s@<>()[\]"]+\.[a-z]{2,}$/i;

/**
 * The organisation's contact email as a mailto link (from config/brand.ts), the only contact
 * shown on the site. Until it's filled in: a visible placeholder.
 */
export function contactEmailMarkdown(locale: "en" | "he") {
  const email = BRAND.contactEmail.trim();
  if (!EMAIL.test(email)) return locale === "he" ? "**[כתובת מייל]**" : "**[contact email]**";
  return `[${email}](mailto:${email})`;
}

export async function legalText(doc: keyof typeof DOCS) {
  const text = await readFile(path.join(process.cwd(), "legal", DOCS[doc]), "utf8");
  return text.replaceAll("{{contact_email}}", contactEmailMarkdown(doc === "privacy-residents" ? "he" : "en"));
}
