import { expect, test } from "@playwright/test";

test("a student signs in, takes a resident's request and sees the contact after the code of conduct", async ({ page, browser }) => {
  // a resident asks for help
  const resident = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await resident.goto("/residents/help");
  await resident.getByRole("button", { name: "אימייל" }).click();
  for (let i = 0; i < 3; i++) await resident.getByRole("button", { name: "הבא", exact: true }).click();
  await resident.getByLabel("שם", { exact: true }).fill("אסתר ישראלי");
  await resident.getByLabel("טלפון", { exact: true }).fill("058-111-2233");
  await resident.getByRole("button", { name: "הבא", exact: true }).click();
  await resident.getByRole("button", { name: "אני מאשר/ת ושולח/ת" }).click();
  await expect(resident.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();

  // the board shows the first name and the need, never the phone
  await page.goto("/students/digital");
  await expect(page.getByRole("heading", { name: "אסתר" })).toBeVisible();
  await expect(page.getByText("058-111-2233")).toHaveCount(0);
  await expect(page.getByText("ישראלי")).toHaveCount(0);

  // sign in with a magic link (shown on screen because email isn't configured locally)
  await page.goto("/students/sign-in");
  await page.getByLabel("Full name").fill("Dana Student");
  await page.getByLabel("Email").fill("dana@emis.test");
  await page.getByRole("button", { name: "Email me a link" }).click();
  await page.goto((await page.locator("a.break-all").getAttribute("href"))!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/students/digital/mine");

  await page.goto("/students/digital");
  const card = page.locator("li", { has: page.getByRole("heading", { name: "אסתר" }) });
  await card.getByRole("button", { name: "Take this request" }).click();
  await page.waitForURL("**/students/digital/mine?taken=taken");
  await expect(page.getByText("058-111-2233")).toHaveCount(0);

  await page.getByLabel("I have read and accept the code of conduct").check();
  await page.getByRole("button", { name: "Show contact details" }).click();
  await expect(page.getByText("058-111-2233")).toBeVisible();
});
