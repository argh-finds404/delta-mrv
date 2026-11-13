// The 60-second demo, end to end (docs/11-IMPLEMENTATION.md §3), against the local stack:
//
//   1. the field submitter submits a before/after pair, and the checks run
//   2. the submitter's own organisation cannot review it (the conflict-of-interest rule)
//   3. verifier one approves: still in review
//   4. verifier two approves: APPROVED
//   5. a verifier-organisation admin presses "Anchor now": confirmed on the local chain
//   6. a stranger opens the public proof page: their browser recomputes the fingerprint, the
//      contract confirms it, and the original photo dropped on the page matches
//   7. the funder sees the record, makes an API key and reads the portfolio with it
//
// Every run submits two photos that have never existed before, so nothing depends on a previous run.
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

const PASSWORD = "delta-demo-2026"; // src/lib/demo-accounts.ts: seeded demo databases only
const REASON = "Both frames show the same plot from the same bank, and the new planting is visible in the after photo.";

/** A photo nobody has submitted before: random colour blocks, as a real JPEG. */
async function freshPhoto(): Promise<Buffer> {
  const [W, H, B] = [640, 480, 40];
  const blocks = randomBytes((W / B) * (H / B) * 3);
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const b = (Math.floor(y / B) * (W / B) + Math.floor(x / B)) * 3;
      raw.set(blocks.subarray(b, b + 3), (y * W + x) * 3);
    }
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

test("a claim goes from a field photo to a proof a stranger can check", async ({ browser, request }) => {
  const [before, after] = [await freshPhoto(), await freshPhoto()];

  // the seeded Sundarbans site
  const listed = (await (await request.get("/api/v1/projects")).json()) as { items: { id: string; title: string }[] };
  const project = listed.items.find((p) => p.title.startsWith("Koyra Mangrove Belt"));
  expect(project, "the seeded Koyra project (pnpm db:seed)").toBeTruthy();

  // 1. the field submitter submits the pair
  const owner = await signedIn(browser, "submitter@delta-demo.example");
  await owner.goto(`/projects/${project!.id}/submit`);
  const inputs = owner.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles({ name: "before.jpg", mimeType: "image/jpeg", buffer: before });
  await inputs.nth(1).setInputFiles({ name: "after.jpg", mimeType: "image/jpeg", buffer: after });
  const submit = owner.getByRole("button", { name: "Submit for Independent Review" });
  await expect(submit).toBeEnabled();
  const [draft] = await Promise.all([owner.waitForResponse((r) => r.url().endsWith("/api/submissions") && r.request().method() === "POST"), submit.click()]);
  const { id } = (await draft.json()) as { id: string };
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  // the server stored the files, fingerprinted them itself, and the checks ran
  await expect(owner.getByText("Waiting for two reviewers from an independent organisation.")).toBeVisible({ timeout: 90_000 });
  expect(await statusOf(owner, id)).toBe("IN_REVIEW");

  // 2. nobody reviews their own organisation's work: not in the queue, and refused if asked directly
  const ownQueue = (await (await owner.request.get(`/api/lab/queue?s=${id}`)).json()) as { isVerifier: boolean; items: unknown[] };
  expect(ownQueue).toMatchObject({ isVerifier: false, items: [] });
  const selfReview = await owner.request.post("/api/lab/decision", { data: { submissionId: id, decision: "APPROVE", reason: REASON } });
  expect(selfReview.status()).toBe(403);
  expect(((await selfReview.json()) as { error: string }).error).toMatch(/own organisation/);
  expect(await statusOf(owner, id)).toBe("IN_REVIEW");

  // 3 and 4. two reviewers of the independent organisation approve, each in writing
  for (const [email, expected] of [["verifier1@delta-demo.example", "IN_REVIEW"], ["verifier2@delta-demo.example", "APPROVED"]] as const) {
    const verifier = await signedIn(browser, email);
    await verifier.goto(`/lab?s=${id}`);
    await verifier.locator("#decision-reason").fill(REASON);
    const decided = verifier.waitForResponse((r) => r.url().endsWith("/api/lab/decision"), { timeout: 30_000 });
    await verifier.getByRole("button", { name: /^Approve/ }).click();
    expect((await decided).status()).toBe(200); // after the five-second undo window
    await expect.poll(() => statusOf(verifier, id)).toBe(expected);
    await verifier.context().close();
  }

  // approved, sealed, not anchored: the public proof says so, and compares nothing yet
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/proof/${id}`);
  await expect(stranger.getByTestId("proof-verdict")).toHaveAttribute("data-state", "PENDING");

  // 5. "Anchor now", by an admin of the verifier organisation
  const admin = await signedIn(browser, "audit-admin@delta-demo.example");
  await admin.goto("/admin");
  await expect(admin.getByTestId("anchor-waiting")).not.toHaveText("0");
  await admin.getByRole("button", { name: "Anchor now" }).click();
  await expect(admin.getByTestId("anchor-result")).toHaveAttribute("data-ok", "true", { timeout: 120_000 });
  await expect(admin.getByTestId("anchor-result")).toContainText("confirmed on chain");
  await expect(admin.getByTestId("anchor-batch").first()).toHaveAttribute("data-status", "CONFIRMED");
  await expect(admin.getByTestId("anchor-waiting")).toHaveText("0");
  // an owner is shown nothing of the panel: the service refuses, and the page is the not-found page
  await owner.goto("/admin");
  await expect(owner.getByText(/could not be found|not found/i).first()).toBeVisible();
  await expect(owner.getByRole("button", { name: "Anchor now" })).toHaveCount(0);

  // 6. a stranger with a browser: no session, nothing taken on the server's word
  await stranger.reload();
  await expect(stranger.getByTestId("proof-verdict")).toHaveAttribute("data-state", "MATCH", { timeout: 60_000 });
  await expect(stranger.getByRole("heading", { name: "Chain anchor" })).toBeVisible();
  const drop = stranger.locator('input[type="file"]');
  await drop.setInputFiles({ name: "after.jpg", mimeType: "image/jpeg", buffer: after });
  await expect(stranger.getByText(/matches the anchored record byte-for-byte/)).toBeVisible();
  await drop.setInputFiles({ name: "other.jpg", mimeType: "image/jpeg", buffer: await freshPhoto() });
  await expect(stranger.getByText(/does not match any evidence file/)).toBeVisible();

  // the same proof as data, for anyone: the sealed record and its path, and no exact location
  const bundle = await request.get(`/api/v1/submissions/${id}/proof`);
  const text = await bundle.text();
  const proof = JSON.parse(text) as { submission: { status: string }; manifest: { files: unknown[] }; anchor: { status: string; proof: string[] } };
  expect(proof.submission.status).toBe("ANCHORED");
  expect(proof.anchor.status).toBe("CONFIRMED");
  expect(proof.manifest.files).toHaveLength(2);
  expect(text).not.toMatch(/salt|boundary/i);

  // 7. the funder: the record is on their page, and a key they make reads the portfolio
  const funder = await signedIn(browser, "funder@delta-demo.example");
  await expect(funder.getByRole("heading", { name: "What your funding has on record" })).toBeVisible();
  await expect(funder.locator(`a[href="/proof/${id}"]`)).toBeVisible();
  expect((await funder.request.get("/api/v1/stats")).status()).toBe(401); // a session is not a key
  await funder.getByRole("button", { name: "New API key" }).click();
  await expect(funder.getByTestId("api-key-secret")).toHaveText(/^dmrv_[0-9a-f]{12}_/);
  await funder.getByRole("button", { name: "Run it here" }).click();
  await expect(funder.getByTestId("api-key-reply")).toContainText("HTTP 200");
  await expect(funder.getByTestId("api-key-reply")).toContainText('"approved"');
  await funder.getByRole("button", { name: "Revoke" }).first().click();
  await expect(funder.getByText(/^Revoked /).first()).toBeVisible();
});
