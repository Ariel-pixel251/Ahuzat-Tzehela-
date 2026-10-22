import { expect, test, type Page } from "@playwright/test";

// Branding v2: "ביחד לדורות" is the parent organisation, this site its EMIS branch (with Ahuzat
// Tzahala as partner). The organisation's logo must NEVER appear without the branch label.

const PAGES = [
  "/",
  "/residents",
  "/residents/events",
  "/residents/help",
  "/residents/podcast",
  "/residents/report",
  "/residents/privacy",
  "/students",
  "/students/events",
  "/students/podcast",
  "/students/digital-support",
  "/students/privacy",
];

const LABEL = /^(סניף EMIS|EMIS Branch)$/;

/** Every rendering of the organisation's logo sits in a lockup with a visible branch label. */
async function expectLogoAlwaysLabelled(page: Page) {
  const logos = page.locator('img[src*="beyachad-ledorot"]');
  const count = await logos.count();
  for (let i = 0; i < count; i++) {
    const logo = logos.nth(i);
    const lockup = logo.locator("xpath=ancestor::*[@data-brand-lockup][1]");
    await expect(lockup, `logo ${i} on ${page.url()} is not inside a BrandLockup`).toHaveCount(1);
    const label = lockup.locator("[data-branch-label]");
    await expect(label, `logo ${i} on ${page.url()} has no branch label`).toBeVisible();
    const lines = (await label.locator(":scope > span").allInnerTexts()).filter(Boolean);
    for (const text of lines.length ? lines : [await label.innerText()]) expect(text.trim()).toMatch(LABEL);
  }
  return count;
}

for (const path of PAGES) {
  test(`${path}: the organisation's logo always has the branch label; no "EMIS ×" heading`, async ({ page }) => {
    await page.goto(path);
    expect(await expectLogoAlwaysLabelled(page)).toBeGreaterThan(0);
    await expect(page.getByText(/EMIS ×|EMIS x Ahuzat/)).toHaveCount(0);
  });
}

test("landing: logo + branch label, tagline, two partner doors, partners strip, disclaimer and privacy links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "ביחד לדורות, סניף EMIS" })).toBeVisible();
  await expect(page.getByText("EMIS Branch", { exact: true })).toBeVisible();
  await expect(page.getByText("סניף EMIS של ביחד לדורות, בשיתוף אחוזת צהלה")).toBeVisible();
  const residents = page.getByRole("link", { name: "אני דייר/ת באחוזת צהלה" });
  const students = page.getByRole("link", { name: "I'm an EMIS student" });
  for (const door of [residents, students]) {
    const box = (await door.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(96);
    await expect(door.locator("img")).toHaveCount(1); // the partner's logo inside the button
  }
  const footer = page.locator("footer");
  await expect(footer.getByText("In partnership with")).toBeVisible();
  await expect(footer.getByRole("img", { name: "EMIS", exact: true })).toBeVisible();
  await expect(footer.getByRole("img", { name: "אחוזת צהלה" })).toBeVisible();
  await expect(footer.getByText(/אינו האתר הרשמי של הארגון כולו/)).toBeVisible();
  await expect(footer.getByRole("link", { name: "פרטיות" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Privacy notice" })).toBeVisible();
});

test("residents: lockup links home, back-home text button, Ahuzat Tzahala at the end; EMIS in the footer; tab title", async ({ page }) => {
  await page.goto("/residents/events");
  await expect(page).toHaveTitle(/ביחד לדורות, סניף EMIS \| אחוזת צהלה/);
  const header = page.locator("header").first();
  await expect(header).not.toHaveCSS("position", "sticky");
  await expect(header.getByRole("link", { name: "ביחד לדורות, סניף EMIS" })).toBeVisible();
  await expect(header.getByRole("img", { name: "אחוזת צהלה" })).toBeVisible();
  await expect(page.getByRole("link", { name: "חזרה לדף הראשי" })).toBeVisible();
  const footer = page.locator("footer");
  await expect(footer.getByText("בשיתוף", { exact: true })).toBeVisible();
  await expect(footer.getByRole("img", { name: "EMIS", exact: true })).toBeVisible();
  await expect(footer.getByText(/אינו האתר הרשמי של הארגון כולו/)).toBeVisible();
  await header.getByRole("link", { name: "ביחד לדורות, סניף EMIS" }).click();
  await expect(page).toHaveURL(/\/residents$/);
});

test("students: lockup links home, EMIS logo at the end; Ahuzat Tzahala in the footer; tab title", async ({ page }) => {
  await page.goto("/students/events");
  await expect(page).toHaveTitle(/Together for Generations, EMIS Branch \| Ahuzat Tzahala/);
  const header = page.locator("header").first();
  await expect(header.getByRole("link", { name: "Together for Generations, EMIS Branch" })).toBeVisible();
  await expect(header.getByRole("img", { name: "EMIS", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  const footer = page.locator("footer");
  await expect(footer.getByText("In partnership with")).toBeVisible();
  await expect(footer.getByRole("img", { name: "Ahuzat Tzahala" })).toBeVisible();
  await expect(footer.getByText(/not the official website of the whole organization/)).toBeVisible();
});

for (const [label, viewport] of [
  ["360px", { width: 360, height: 800 }],
  ["768px", { width: 768, height: 900 }],
  ["200% zoom", { width: 640, height: 400 }],
  ["1280px", { width: 1280, height: 800 }],
] as const) {
  test(`no sideways scrolling, and the header lockup stays on one line, at ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/residents", "/residents/help", "/students", "/students/events"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
      if (path !== "/") {
        const lockup = page.locator("header [data-brand-lockup]").first();
        const [logo, text] = [await lockup.locator("img").boundingBox(), await lockup.locator("[data-branch-label]").boundingBox()];
        // logo and label side by side (vertically overlapping), not wrapped onto two lines
        expect(text!.y, path).toBeLessThan(logo!.y + logo!.height);
      }
    }
  });
}

test("tab icon and share image are the lockup with the branch label", async ({ page, request }) => {
  await page.goto("/residents");
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /\/icons\/(favicon-48|icon-512)\.png/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:\/\/.+\/og\.png/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "ביחד לדורות, סניף EMIS | אחוזת צהלה");
  for (const path of ["/og.png", "/icons/icon-512.png", "/logos/email/beyachad-ledorot.png"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toBe("image/png");
  }
});
