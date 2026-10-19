import { test, type Page } from "@playwright/test";

// Regenerates docs/screenshots (mobile width). Run with: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to update the screenshots");

const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage });

async function residentHelpRequest(page: Page, need: string, name: string, phone: string) {
  await page.goto("/residents/help");
  await page.getByRole("button", { name: need }).click();
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await page.getByRole("button", { name: "שלישי" }).click();
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await page.getByRole("button", { name: "מאוחר יותר" }).nth(1).click();
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await page.getByLabel("שם", { exact: true }).fill(name);
  await page.getByLabel("טלפון", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await page.getByRole("button", { name: "אני מאשר/ת ושולח/ת" }).click();
  await page.getByRole("heading", { name: "תודה! קיבלנו." }).waitFor();
}

test("screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });

  // resident portal
  await page.goto("/residents");
  await shot(page, "residents-home");
  await page.goto("/residents/events");
  await page.locator("main li", { has: page.getByRole("link") }).first().screenshot({ path: "docs/screenshots/residents-event-card.png" });
  await page.goto("/residents/help");
  await page.getByRole("button", { name: "וואטסאפ" }).click();
  await page.getByRole("button", { name: "טלפון" }).click();
  await shot(page, "residents-wizard-step");

  // data for the other screens
  await residentHelpRequest(page, "וואטסאפ", "רבקה כהן", "050-123-4567");
  await shot(page, "residents-confirmation");
  await residentHelpRequest(page, "בנק באינטרנט", "יוסף לוי", "052-765-4321");

  // student portal
  await page.goto("/students");
  await shot(page, "students-home");
  await page.goto("/students/digital");
  await shot(page, "students-digital-support");

  // admin
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Dev sign-in" }).click();
  await page.waitForURL("**/admin");
  await shot(page, "admin-dashboard");
});
