import { expect, test } from "@playwright/test";
import { adminSignIn, contact, createPodcastTime, inDays, next, send } from "./helpers";

// Podcast times: the admin creates them; residents and students choose one; a pair who chose the
// same time meets then.

test("a resident and a student choose the admin's podcast time; pairing them sets the meeting", async ({ page }) => {
  const date = inDays(12);
  await adminSignIn(page);
  await createPodcastTime(page, { date, start: "15:00", end: "16:00", place: "בחדר המוזיקה", placeEn: "Music room", pairs: 1 });
  await expect(page.getByRole("region", { name: "Podcast times" }).getByText(/Music room/)).toBeVisible();

  // a resident chooses it
  await page.goto("/residents/podcast");
  await page.getByRole("button", { name: "מוזיקה" }).click();
  await next(page);
  await next(page);
  const time = page.getByRole("radio", { name: /15:00 עד 16:00, בחדר המוזיקה/ });
  await expect(time).toContainText("נשאר מקום אחד");
  await time.click();
  await next(page);
  await contact(page, "רחל גולן", "053-777-1122");
  await send(page);
  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();
  await expect(page.getByText(/15:00 עד 16:00, בחדר המוזיקה/)).toBeVisible();

  // now it's full for residents: shown, but it can't be chosen
  await page.goto("/residents/podcast");
  await page.getByRole("button", { name: "מוזיקה" }).click();
  await next(page);
  await next(page);
  await expect(page.getByRole("radio", { name: /15:00 עד 16:00, בחדר המוזיקה/ })).toContainText("מלא");
  await expect(page.getByRole("radio", { name: /15:00 עד 16:00, בחדר המוזיקה/ })).toHaveAttribute("aria-disabled", "true");

  // a student chooses the same time
  await page.goto("/students/podcast");
  await page.getByLabel("Full name").fill("Yael Student");
  await page.getByLabel("Email").fill("yael@emis.test");
  await page.getByRole("button", { name: /Topics I'm interested in/ }).click();
  await page.getByLabel("Music").check();
  await page.getByLabel("When can you meet?").selectOption({ label: (await page.getByRole("option", { name: /Music room/ }).textContent())! });
  await page.getByLabel(/I agree to the privacy notice/).check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/You're signed up!/)).toBeVisible();

  // the admin sees both, pairs them without typing a meeting: it's set to the time they chose
  await page.goto("/admin/podcast");
  const row = page.getByRole("region", { name: "Podcast times" }).getByRole("row", { name: /Music room/ });
  await expect(row).toContainText("1 of 1");
  const pairForm = page.getByRole("region", { name: "Make a pair" });
  await pairForm.getByLabel("Who").first().selectOption({ label: (await pairForm.getByRole("option", { name: /רחל גולן/ }).first().textContent())! });
  await pairForm.getByLabel("Who").nth(1).selectOption({ label: (await pairForm.getByRole("option", { name: /Yael Student/ }).first().textContent())! });
  await pairForm.getByRole("button", { name: "Make the pair" }).click();
  await expect(page.getByText(/Paired/)).toBeVisible();
  await page.goto("/admin/podcast");
  await expect(page.getByText(new RegExp(`meets ${date} 15:00, בחדר המוזיקה`))).toBeVisible();
});
