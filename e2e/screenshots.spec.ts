import { expect, test, type Page } from "@playwright/test";
import { adminSignIn, createSlot } from "./helpers";

// Regenerates docs/screenshots (mobile width). Run with: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to update the screenshots");

// caret "initial": Playwright otherwise injects a style to hide the cursor, which the dev server reports as an issue
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage, caret: "initial" });

/** The next Tuesday at least 3 days away ("YYYY-MM-DD"). */
function nextTuesday() {
  const d = new Date(Date.now() + 3 * 86_400_000);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

test("screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });

  // admin: the slot creation page (with a weekly series made through it)
  await adminSignIn(page);
  const first = nextTuesday();
  const until = new Date(Date.parse(`${first}T00:00:00Z`) + 21 * 86_400_000).toISOString().slice(0, 10);
  await createSlot(page, { date: first, until, place: "בחדר הקהילה", placeEn: "Community room", residents: 4, helpers: 2 });
  await page.goto("/admin/digital-support");
  await page.locator("section", { has: page.getByRole("heading", { name: "Create slots" }) }).screenshot({ path: "docs/screenshots/admin-slot-creation.png", caret: "initial" });

  // landing and resident portal
  await page.goto("/");
  await shot(page, "landing");
  await page.goto("/residents");
  await shot(page, "residents-home");
  await page.goto("/residents/help");
  await expect(page.getByRole("radio").first()).toBeVisible();
  await page.getByRole("radio").first().click();
  await shot(page, "residents-booking-step");

  // student portal
  await page.goto("/students/digital-support");
  await shot(page, "students-slots");
});

// Branding v2 at 360, 768 and 1280px (docs/screenshots/branding/): landing, both homes, both footers.
test("branding screenshots", async ({ page }) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [["landing", "/"], ["residents-home", "/residents"], ["students-home", "/students"]] as const) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await shot(page, `branding/after-${name}-${width}`);
    }
    for (const [name, path] of [["residents-footer", "/residents"], ["students-footer", "/students"]] as const) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.locator("footer").last().screenshot({ path: `docs/screenshots/branding/after-${name}-${width}.png`, caret: "initial" });
    }
  }
});
