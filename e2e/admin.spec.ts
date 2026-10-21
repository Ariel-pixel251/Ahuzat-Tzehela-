import { expect, test } from "@playwright/test";
import { adminSignIn } from "./helpers";

// Admin: groups with people who never signed up, and the "who and when" message.

test("make a podcast pair from two people typed in, with a meeting time and a message", async ({ page }) => {
  await adminSignIn(page);
  await page.goto("/admin/podcast");
  await page.getByLabel("Who").first().selectOption("new");
  await page.getByLabel("Name").first().fill("Noa Student");
  await page.getByLabel("They are a").first().selectOption("student");
  await page.getByLabel("Who").nth(1).selectOption("new");
  await page.getByLabel("Name").nth(1).fill("Moshe Resident");
  await page.getByLabel("They are a").nth(1).selectOption("resident");
  await page.getByLabel("Phone (optional)").nth(1).fill("052-111-2233");
  await page.getByLabel("Date").fill("2030-11-03");
  await page.getByLabel("Time").fill("16:00");
  await page.getByLabel("Place").fill("בספרייה");
  await page.getByRole("button", { name: "Make the pair" }).click();
  await expect(page.getByText(/Paired\. Both were sent a message/)).toBeVisible();

  await page.goto("/admin/podcast");
  await expect(page.getByText("Noa Student (student) + Moshe Resident (resident)")).toBeVisible();
  await expect(page.getByText(/meets 2030-11-03 16:00, בספרייה/)).toBeVisible();
  // the resident has no email: the message waits in the "send by hand" list
  await page.goto("/admin/messages");
  await expect(page.getByText(/השותף שלכם לפודקאסט: Noa/)).toBeVisible();
});
