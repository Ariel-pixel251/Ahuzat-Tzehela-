import { expect, test } from "@playwright/test";

// Student portal (English): the home page, event registration and podcast sign-up.

test("home: the branch's name and tagline, and Events, Digital support, Podcast and My sign-ups", async ({ page }) => {
  await page.goto("/students");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Together for Generations, EMIS Branch");
  await expect(page.getByText("The EMIS branch of Together for Generations, in partnership with Ahuzat Tzahala").first()).toBeVisible();
  for (const name of ["Events", "Digital support", "Podcast", "My sign-ups"]) {
    await expect(page.locator("main").getByRole("link", { name: new RegExp(`^${name}`) }).first()).toBeVisible();
  }
});

test("register for language night (name, phone, email, languages, privacy consent)", async ({ page }) => {
  await page.goto("/students/events");
  await page.getByRole("link", { name: /Register.*Language night/ }).first().click();
  await page.getByLabel("Full name").fill("Dana Student");
  await page.getByLabel("Email").fill("dana.events@emis.test");
  await page.getByLabel("Phone", { exact: true }).fill("050-555-1234");
  await page.getByRole("button", { name: /Languages I can speak/ }).click();
  await page.getByLabel("English").check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Please confirm you agree to the privacy notice.")).toBeVisible();
  await page.getByLabel(/I agree to the privacy notice/).check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/You're registered for Language night/)).toBeVisible();
});

test("podcast sign-up shows a private page link", async ({ page }) => {
  await page.goto("/students/podcast");
  await page.getByLabel("Full name").fill("Omer Student");
  await page.getByLabel("Email").fill("omer@emis.test");
  await page.getByRole("button", { name: /Topics I'm interested in/ }).click();
  await page.getByLabel("Music").check();
  await page.getByLabel(/I agree to the privacy notice/).check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/You're signed up!/)).toBeVisible();
});
