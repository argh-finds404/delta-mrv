// A survival check-up, end to end on the local stack:
//
//   1. a pair is submitted and approved by two reviewers from the independent organisation
//   2. the field team starts a check-up of that record: the record's own photo is shown to stand
//      where it was taken, and today's photo is laid over it to check the framing
//   3. the check-up reaches the review queue, where it is compared with the approved photo
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

const PASSWORD = "delta-demo-2026"; // src/lib/demo-accounts.ts: seeded demo databases only
const REASON = "Both frames show the same plot from the same bank, and the new planting is visible in the after photo.";

async function freshPhoto(): Promise<Buffer> {
  const [W, H, B] = [640, 480, 40];
  const blocks = randomBytes((W / B) * (H / B) * 3);
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw.set(blocks.subarray((Math.floor(y / B) * (W / B) + Math.floor(x / B)) * 3, (Math.floor(y / B) * (W / B) + Math.floor(x / B)) * 3 + 3), (y * W + x) * 3);
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
}

async function signedIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard");
  return page;
}

const statusOf = async (page: Page, id: string) => {
  const res = await page.request.get(`/api/submissions/${id}/findings`);
  return res.ok() ? ((await res.json()) as { submission: { status: string } }).submission.status : `HTTP ${res.status()}`;
};

test("an approved record is photographed again, framed against itself, and reviewed as a check-up", async ({ browser, request }) => {
  const listed = (await (await request.get("/api/v1/projects")).json()) as { items: { id: string; title: string }[] };
  const project = listed.items.find((p) => p.title.startsWith("Koyra Mangrove Belt"))!;

  // 1. a record, approved
  const owner = await signedIn(browser, "submitter@delta-demo.example");
  await owner.goto(`/projects/${project.id}/submit`);
  await owner.locator('input[type="file"]').nth(0).setInputFiles({ name: "before.jpg", mimeType: "image/jpeg", buffer: await freshPhoto() });
  await owner.locator('input[type="file"]').nth(1).setInputFiles({ name: "after.jpg", mimeType: "image/jpeg", buffer: await freshPhoto() });
  await expect(owner.getByTestId("framing-check")).toBeVisible(); // the pair is laid one over the other too
  const [draft] = await Promise.all([owner.waitForResponse((r) => r.url().endsWith("/api/submissions") && r.request().method() === "POST"), owner.getByRole("button", { name: "Submit for Independent Review" }).click()]);
  const { id: record } = (await draft.json()) as { id: string };
  await expect(owner.getByText("Waiting for two reviewers from an independent organisation.")).toBeVisible({ timeout: 90_000 });
  for (const email of ["verifier1@delta-demo.example", "verifier2@delta-demo.example"]) {
    const v = await signedIn(browser, email);
    await v.goto(`/lab?s=${record}`);
    await v.locator("#decision-reason").fill(REASON);
    const decided = v.waitForResponse((r) => r.url().endsWith("/api/lab/decision"), { timeout: 30_000 });
    await v.getByRole("button", { name: /^Approve/ }).click();
    expect((await decided).status()).toBe(200);
    await v.context().close();
  }
  await expect.poll(() => statusOf(owner, record)).toBe("APPROVED");

  // 2. the check-up: the record's photo first, then today's laid over it
  await owner.goto(`/projects/${project.id}/submit?checkup=${record}`);
  await expect(owner.getByRole("heading", { name: "Survival check-up" })).toBeVisible();
  await expect(owner.getByTestId("checkup-reference")).toBeVisible();
  await owner.waitForLoadState("networkidle");
  await owner.locator('input[type="file"]').first().setInputFiles({ name: "today.jpg", mimeType: "image/jpeg", buffer: await freshPhoto() });
  await expect(owner.getByTestId("framing-check")).toBeVisible();
  await owner.getByRole("group", { name: "Show" }).getByRole("button", { name: "Earlier" }).click();
  await expect(owner.getByLabel("Blend between the earlier photo and today's")).toHaveValue("0");
  const [visitDraft] = await Promise.all([owner.waitForResponse((r) => r.url().endsWith("/api/submissions") && r.request().method() === "POST"), owner.getByRole("button", { name: "Submit the check-up" }).click()]);
  const { id: visit } = (await visitDraft.json()) as { id: string };
  await expect(owner.getByText("Waiting for two reviewers from an independent organisation.")).toBeVisible({ timeout: 90_000 });

  // 3. the reviewer compares it with the approved photo, and is told what it is
  const v1 = await signedIn(browser, "verifier1@delta-demo.example");
  await v1.goto(`/lab?s=${visit}`);
  await expect(v1.getByTestId("checkup-note")).toBeVisible({ timeout: 30_000 });
  await expect(v1.getByText("Approved record", { exact: true }).first()).toBeVisible();
  await expect(v1.getByText("Check-up", { exact: true }).first()).toBeVisible();
});
