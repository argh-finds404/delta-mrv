// Joining an organisation without email (docs/16-AMENDMENTS-v2.md A14):
//
//   1. an administrator records an invitation for an address and is shown a link, once
//   2. the colleague opens it with no account, signs up (no organisation to register) and joins
//   3. they are a member, and the invitation is spent
import { expect, test } from "@playwright/test";
import { linkFromEmail } from "./outbox";

const PASSWORD = "delta-demo-2026"; // src/lib/demo-accounts.ts: seeded demo databases only

test("a colleague joins an organisation through an invitation link", async ({ browser }) => {
  const email = `invited-${Date.now()}@example.test`;

  // 1. the verifier organisation's administrator
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/sign-in");
  await admin.locator("#email").fill("audit-admin@delta-demo.example");
  await admin.locator("#password").fill(PASSWORD);
  await admin.locator('button[type="submit"]').click();
  await admin.waitForURL("**/dashboard");
  await admin.getByLabel("Their email address").fill(email);
  await admin.getByRole("button", { name: "Create the invitation link" }).click();
  const link = (await admin.getByTestId("invitation-link").textContent())!.trim();
  expect(link).toMatch(/\/dashboard\?invite=[0-9a-f-]{36}$/);
  const waiting = admin.locator("li", { hasText: email }).filter({ hasText: "until" });
  await expect(waiting).toHaveCount(1);

  // 2. the colleague has no account: the link leads through sign-in to a one-step sign-up
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(link);
  await guest.waitForURL(/\/sign-in\?next=/);
  await guest.getByRole("link", { name: "Create an account" }).click();
  await guest.waitForURL(/\/sign-up\?next=/);
  await expect(guest.getByText("You were invited")).toBeVisible();
  // scoped to the sign-up form: the sign-in form is still leaving the page when the address changes
  const signUp = guest.locator("form").filter({ has: guest.locator("#name") });
  await signUp.locator("#name").fill("Invited Reviewer");
  await signUp.locator("#email").fill(email);
  await signUp.locator("#password").fill("a-long-test-password-1");
  await signUp.getByRole("button", { name: "Create account" }).click();
  // the local stack confirms addresses: the emailed link signs them in and returns to the invitation
  await expect(guest.getByTestId("check-email")).toContainText(email);
  await guest.goto(await linkFromEmail(email, /Confirm your email/));
  await guest.waitForURL(/\/dashboard\?invite=/);
  await guest.getByRole("button", { name: "Join Delta Independent Audit" }).click();
  await guest.waitForURL(/\/dashboard$/);

  // 3. a member of a verifier organisation has the Review tab; the invitation cannot be used again
  await expect(guest.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: /^Review/ })).toBeVisible();
  await admin.reload();
  await expect(admin.getByRole("heading", { name: /^People in/ })).toBeVisible();
  await expect(admin.locator("li", { hasText: email }).first()).toBeVisible(); // now in the list of people
  await expect(waiting).toHaveCount(0);
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: "This invitation cannot be used" })).toBeVisible();
});
