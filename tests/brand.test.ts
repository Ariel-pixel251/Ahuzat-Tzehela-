import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { BRAND } from "@/config/brand";
import { emailHtml } from "@/lib/notify/html";
import { templates } from "@/lib/notify/templates";

// The brand structure: "ביחד לדורות" is the parent organisation and this site is only its EMIS
// branch, so the organisation's logo never appears without the branch label.

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(p)));
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("brand", () => {
  test("only BrandLockup (and the email header, which adds the label) uses the organisation's logo", async () => {
    const allowed = new Set([path.join("components", "BrandLockup.tsx"), path.join("config", "logos.ts"), path.join("lib", "notify", "html.ts")]);
    const users: string[] = [];
    for (const dir of ["app", "components", "lib", "config"]) {
      for (const file of await sourceFiles(dir)) {
        const text = await readFile(file, "utf8");
        if (/beyachad/.test(text) && !allowed.has(file)) users.push(file);
      }
    }
    expect(users).toEqual([]);
  });

  test("the email header shows the branch label next to the organisation's logo, as text", () => {
    for (const locale of ["he", "en"] as const) {
      const html = emailHtml("Hi", locale);
      const logoAt = html.indexOf("beyachad-ledorot.png");
      const labelAt = html.indexOf(`>${BRAND.branchLabel[locale]}</td>`);
      expect(logoAt, locale).toBeGreaterThan(0);
      expect(labelAt, locale).toBeGreaterThan(logoAt);
      // in the same row as the logo
      expect(html.slice(logoAt, labelAt)).not.toContain("</tr>");
      expect(html).toContain(BRAND.partnersLabel[locale]);
    }
  });

  test("messages are signed with the organisation and the branch, never 'EMIS ×'", () => {
    const he = templates.podcastJoined("he", { name: "רבקה", code: "1234" }).body;
    const en = templates.podcastJoined("en", { name: "Dana", code: "1234", manageUrl: "https://x.test/p" }).body;
    expect(he).toContain(BRAND.branchName.he);
    expect(en).toContain(BRAND.branchName.en);
    expect(he + en).not.toMatch(/EMIS ×/);
  });

  test("the colour tokens are the colours measured from the logo files", async () => {
    const measured = JSON.parse(await readFile("design/logo-colors.json", "utf8")) as Record<string, string>;
    const css = await readFile("app/globals.css", "utf8");
    const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1].toLowerCase();
    expect(token("brand")).toBe(measured.beyachadBlue);
    expect(token("teal")).toBe(measured.beyachadTeal);
    expect(token("maroon")).toBe(measured.ahuzatMaroon);
    expect(token("emis")).toBe(measured.emisOrange);
  });

  test("no 'EMIS ×' heading is left in the site's wording", async () => {
    for (const file of ["config/brand.ts", "lib/i18n/he.ts", "lib/i18n/en.ts", "lib/site-metadata.ts", "lib/notify/templates.ts", "lib/notify/smtp.ts"]) {
      expect(await readFile(file, "utf8"), file).not.toMatch(/EMIS ×|EMIS x Ahuzat/);
    }
  });
});
