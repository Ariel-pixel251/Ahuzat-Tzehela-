import { expect, test, type Page } from "@playwright/test";
import { adminSignIn, createSlot, inDays } from "./helpers";

// Regenerates docs/screenshots (mobile width). Run with: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to update the screenshots");

const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage });

test("screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });

  // admin: the slot creation page (with a weekly series made through it)
  await adminSignIn(page);
  await createSlot(page, { date: inDays(4), until: inDays(25), place: "בחדר הקהילה", placeEn: "Community room", residents: 4, helpers: 2 });
  await page.goto("/admin/digital-support");
  await page.locator("section", { has: page.getByRole("heading", { name: "Create slots" }) }).screenshot({ path: "docs/screenshots/admin-slot-creation.png" });

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
