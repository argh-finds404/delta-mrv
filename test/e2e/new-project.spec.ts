// A new site, from nothing to reviewable, and the admin's audit-chain panel:
//
//   1. an owner registers a project, drawing its boundary on the map
//   2. the owner asks for a reviewer; nobody in the owner organisation can open /admin
//   3. an operator (on a demo deployment, the seeded audit admin) assigns an independent
//      verifier organisation, and the project leaves the list
//   4. every audit chain verifies, and the tamper demo names the event it edited
import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "delta-demo-2026"; // src/lib/demo-accounts.ts: seeded demo databases only

async function signedIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard");
  return page;
}

test("an owner registers a site, asks for a reviewer, and an operator assigns one", async ({ browser }) => {
  const title = `Test wetland ${Date.now()}`;

  // 1. the owner draws the boundary: four corners, placed by clicking the map
  const owner = await signedIn(browser, "admin@delta-demo.example");
  await owner.goto("/projects/new");
  await owner.locator('input[name="title"]').fill(title);
  await owner.locator('select[name="activityType"]').selectOption("WETLAND");
  await owner.locator('input[name="claimedQuantity"]').fill("12");
  await owner.locator('input[name="claimedUnit"]').fill("hectares");
  const map = owner.getByRole("application");
  await expect(map.locator("canvas")).toBeVisible({ timeout: 30_000 });
  // refused without a boundary
  await owner.getByRole("button", { name: "Create the project" }).click();
  await expect(owner.getByRole("alert").filter({ hasText: "three corners" })).toBeVisible(); // Next's route announcer is an alert too
  for (const [x, y] of [[180, 160], [320, 150], [340, 300], [170, 310]] as const) await map.click({ position: { x, y } });
  await expect(owner.getByTestId("corner-count")).toHaveText("4 corners placed");
  await expect(owner.locator('input[name="title"]')).toHaveValue(title); // the refusal kept what was typed
  await owner.getByRole("button", { name: "Create the project" }).click();
  await owner.waitForURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(owner.getByRole("heading", { name: title })).toBeVisible();

  // 2. nobody reviews it yet: the owner asks, once
  await owner.getByRole("link", { name: "Manage" }).click();
  await owner.getByRole("button", { name: "Ask for an independent reviewer" }).click();
  await expect(owner.getByTestId("reviewer-requested")).toBeVisible();
  await owner.goto("/admin");
  await expect(owner.getByText(/could not be found/i).first()).toBeVisible();

  // 3. an operator assigns an independent verifier organisation
  const admin = await signedIn(browser, "audit-admin@delta-demo.example");
  await admin.goto("/admin");
  const row = admin.locator("li", { hasText: title });
  await expect(row).toBeVisible();
  await expect(row).toContainText("reviewer asked for");
  await row.getByLabel("Verifier organisation").selectOption({ label: "Delta Independent Audit" });
  await row.getByRole("button", { name: "Assign" }).click();
  await expect(row).toHaveCount(0);

  // 4. the audit chains, verified on the page, and what an edit would look like
  await expect(admin.getByTestId("audit-chain").first()).toHaveAttribute("data-ok", "true");
  await admin.getByRole("button", { name: "Change one event in a copy" }).click();
  await expect(admin.getByTestId("tamper-result")).toContainText("Verifies from the first event to the last.");
  await expect(admin.getByTestId("tamper-result")).toContainText(/Fails at event \d+/);
  // the stored chains are untouched: the page still verifies them all
  await admin.reload();
  for (const chain of await admin.getByTestId("audit-chain").all()) await expect(chain).toHaveAttribute("data-ok", "true");
});
