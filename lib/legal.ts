import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** The editable legal texts in legal/*.md (drafts for review, see LEGAL_TODO.md). */
const DOCS = { "privacy-residents": "privacy-residents.he.md", "privacy-students": "privacy-students.en.md" } as const;

export async function legalText(doc: keyof typeof DOCS) {
  return readFile(path.join(process.cwd(), "legal", DOCS[doc]), "utf8");
}
