import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const residentPages = [
  "/residents",
  "/residents/events",
  "/residents/help",
  "/residents/podcast",
  "/residents/status",
  "/residents/report",
  "/residents/privacy",
];

const studentPages = [
  "/",
  "/students",
  "/students/events",
  "/students/podcast",
  "/students/digital-support",
  "/students/sign-in",
  "/students/report",
  "/students/privacy",
  "/admin/login",
];

// Resident portal: WCAG 2.1 AA plus AAA contrast.
for (const path of residentPages) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag2aaa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

for (const path of studentPages) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("the podcast time question passes axe (AAA)", async ({ page }) => {
  await page.goto("/residents/podcast");
  await page.getByRole("button", { name: "סיפורי חיים" }).click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "הבא", exact: true }).click();
  await expect(page.getByRole("heading", { name: "מתי נוח לכם להיפגש?" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag2aaa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

// No horizontal scrolling at 360px, or at 200% zoom on a 1280px screen (= a 640px layout).
for (const [label, viewport] of [
  ["360px", { width: 360, height: 800 }],
  ["200% zoom", { width: 640, height: 400 }],
] as const) {
  test(`no horizontal scroll at ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of residentPages) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
