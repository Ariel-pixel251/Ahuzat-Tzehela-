import { expect, test } from "@playwright/test";
import { adminSignIn, createPodcastTime, createSlot, inDays, studentCardSignUp } from "./helpers";

// Student portal (English): the home page, event registration, and signing up for a slot or a
// podcast time right on its card (no account, no sign-in).

test("home: the branch's name (for screen readers), and Events, Digital support and Podcast; no 'My sign-ups'", async ({ page }) => {
  await page.goto("/students");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Together for Generations, EMIS Branch");
  for (const name of ["Events", "Digital support", "Podcast"]) {
    await expect(page.locator("main").getByRole("link", { name: new RegExp(`^${name}`) }).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /My sign-ups/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Sign in/ })).toHaveCount(0);
});

test("'Back to main page' in the header leads from any student page to the landing page", async ({ page }) => {
  for (const path of ["/students", "/students/events", "/students/podcast"]) {
    await page.goto(path);
    await page.getByRole("link", { name: "Back to main page" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "I'm an EMIS student" })).toBeVisible();
  }
});

test("old sign-in, 'My sign-ups' and podcast-page links lead to the new pages", async ({ page }) => {
  for (const [from, to] of [
    ["/students/sign-in", "/students/digital-support"],
    ["/students/auth?token=abc", "/students/digital-support"],
    ["/students/mine", "/students/digital-support"],
    ["/students/podcast/manage?token=abc", "/students/podcast"],
  ]) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$|${to}\\?`));
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

test("a student signs up for a digital slot and for a podcast time without leaving the page", async ({ page }) => {
  await adminSignIn(page);
  await createSlot(page, { date: inDays(6), start: "15:00", end: "16:00", place: "בחדר הסטודנטים", placeEn: "Student room", residents: 2, helpers: 2 });
  await createPodcastTime(page, { date: inDays(7), start: "14:00", end: "15:00", place: "באולפן", placeEn: "Studio", residents: 2, students: 2 });

  await page.goto("/students/digital-support");
  const slot = page.locator("main li", { hasText: "Student room" });
  await expect(slot).toContainText("Helpers: 0 of 2");
  // under 18: the parent or guardian is asked for
  await slot.getByRole("button", { name: /^Sign up/ }).click();
  await slot.getByLabel("Full name").fill("Noa Student");
  await slot.getByLabel("School email").fill("noa@emis.test");
  await slot.getByLabel("I'm under 18").check();
  await slot.getByLabel(/I agree to the/).check();
  await slot.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(slot.getByText("Please fill in your parent or guardian's name and phone.").first()).toBeVisible();
  await slot.getByLabel("Parent or guardian's name").fill("Ruth Student");
  await slot.getByLabel("Parent or guardian's phone").fill("054-111-2222");
  await slot.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(slot.getByText("You're in!")).toBeVisible();
  await expect(page).toHaveURL(/\/students\/digital-support$/);

  await page.goto("/students/podcast");
  const time = page.locator("main li", { hasText: "Studio" });
  await expect(time).toContainText("2 places left for students");
  await studentCardSignUp(time, { name: "Noa Student", email: "noa@emis.test", topic: "Music" });
  await expect(page).toHaveURL(/\/students\/podcast$/);
  await page.reload();
  await expect(page.locator("main li", { hasText: "Studio" })).toContainText("1 place left for students");

  // the admin sees the helper with the age group and guardian
  await page.goto("/admin/digital-support");
  const card = page.locator("main li").filter({ hasText: "בחדר הסטודנטים" }).first();
  await expect(card).toContainText("Noa Student");
  await expect(card).toContainText("Under 18");
  await expect(card).toContainText("Ruth Student");
});

test("the code of conduct page", async ({ page }) => {
  await page.goto("/students/code-of-conduct");
  await expect(page.getByRole("heading", { name: "Code of conduct" })).toBeVisible();
  await expect(page.getByText(/Never ask for, look at or write down passwords/)).toBeVisible();
});
