import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const residentPages = [
  "/residents",
  "/residents/events",
  "/residents/register",
  "/residents/help",
  "/residents/podcast",
  "/residents/lecture",
  "/residents/callback",
  "/residents/lessons",
  "/residents/status",
  "/residents/courses",
  "/residents/privacy",
];

const studentPages = ["/", "/students", "/students/schedule", "/students/podcast", "/students/digital", "/students/sign-in", "/students/visit", "/admin/login", "/admin/setup"];

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

test("a wizard step passes axe too", async ({ page }) => {
  await page.goto("/residents/help");
  await page.getByRole("button", { name: "וואטסאפ" }).click();
  await page.getByRole("button", { name: "הבא", exact: true }).click();
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
