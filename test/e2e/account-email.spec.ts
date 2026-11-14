// An account where the server confirms email (the local stack writes each message to .local/outbox):
//
//   1. a new organisation signs up; it is not signed in until the emailed link is opened
//   2. the link signs them in and creates the organisation chosen at sign-up
//   3. a forgotten password is reset through an emailed link; the old one stops working
import { expect, test, type Page } from "@playwright/test";
import { linkFromEmail } from "./outbox";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
}

test("a new organisation confirms its email, then resets a forgotten password", async ({ browser }) => {
  const stamp = Date.now();
  const email = `owner-${stamp}@example.test`;
  const page = await (await browser.newContext()).newPage();

  // 1. sign-up asks for the organisation, then for the email to be confirmed
  await page.goto("/sign-up");
  await page.locator("#name").fill("New Owner");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("first-password-123");
  await page.getByRole("button", { name: "Continue to organisation details" }).click();
  await page.locator("#orgName").fill(`Coastal Trust ${stamp}`);
  await page.getByRole("button", { name: "Project owner" }).click();
  await page.getByRole("button", { name: "Register organisation" }).click();
  await expect(page.getByTestId("check-email")).toContainText(email);
  // not confirmed yet: signing in sends a fresh link instead of a session
  await signIn(page, email, "first-password-123");
  await expect(page.getByRole("alert").filter({ hasText: "Confirm your email first" })).toBeVisible(); // Next's route announcer is an alert too

  // 2. the sign-up link signs them in, and the organisation chosen at sign-up is created
  await page.goto(await linkFromEmail(email, /Confirm your email/, "oldest"));
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await expect(page.getByRole("link", { name: "Register your first project" })).toBeVisible();
  // the second link, sent at sign-in, creates nothing twice: it goes straight to the overview
  await page.goto(await linkFromEmail(email, /Confirm your email/, "newest"));
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
  await expect(page.getByTestId("no-organisation")).toHaveCount(0);

  // 3. signed out, the password forgotten
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  // both pages have an #email field and both are in the page for a moment: scope to this form
  const reset = page.locator("form").filter({ has: page.getByRole("button", { name: "Send the link" }) });
  await reset.locator("#email").fill(email);
  await reset.getByRole("button", { name: "Send the link" }).click();
  await expect(page.getByTestId("check-email")).toContainText(email);
  await page.goto(await linkFromEmail(email, /Reset your Delta password/));
  await page.waitForURL(/\/reset-password\?token=/);
  await page.locator("#new-password").fill("second-password-456");
  await page.getByRole("button", { name: "Save the new password" }).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();

  await signIn(page, email, "first-password-123");
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect" })).toBeVisible();
  await signIn(page, email, "second-password-456");
  await page.waitForURL(/\/dashboard$/);
});
