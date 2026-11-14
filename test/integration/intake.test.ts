// Evidence intake (docs/11-IMPLEMENTATION.md Stage 4): draft, scoped upload token, finalize in one
// transaction from the bytes actually stored, supplements, and the abandoned-draft sweep.
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evidenceFile, evidenceSubmission, forensicFinding, impactProject, job } from "../../src/server/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../../src/server/services/errors";
import { addSupplement, createDraft, finalizeSubmission, issueUploadToken } from "../../src/server/services/submissions.service";
import { sweepAbandonedDrafts } from "../../src/server/services/intake-jobs";
import { client, inRollback, type Tx } from "./db";
import { actor, addSubmission, world, type World } from "./fixtures";
import { memoryStorage } from "./memory-storage";

afterAll(() => client.end());

let JPEG: Uint8Array;
let PNG: Uint8Array;
beforeAll(async () => {
  const raw = { raw: { width: 32, height: 24, channels: 3 as const } };
  JPEG = await sharp(Buffer.alloc(32 * 24 * 3, 90), raw).jpeg().toBuffer();
  PNG = await sharp(Buffer.alloc(32 * 24 * 3, 160), raw).png().toBuffer();
});
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

const scenario = (name: string, fn: (tx: Tx, w: World, store: ReturnType<typeof memoryStorage>) => Promise<void>) =>
  it(name, () =>
    inRollback(async (tx) => {
      await fn(tx, await world(tx), memoryStorage());
    }),
  );

/** A draft with both photos uploaded through tokens, as the browser would. */
async function uploaded(tx: Tx, w: World, store: ReturnType<typeof memoryStorage>, before = JPEG, after = PNG) {
  const draft = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
  const b = await issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
  const a = await issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "AFTER", contentType: "image/png" }, tx, store.port);
  store.put(b.pathname, before);
  store.put(a.pathname, after);
  return { draft, before: b.pathname, after: a.pathname };
}

describe("createDraft", () => {
  scenario("a member of the owning organisation starts a DRAFT; nobody else can, and gets a 404", async (tx, w) => {
    const draft = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
    expect(draft).toMatchObject({ status: "DRAFT", round: 1, projectId: w.project.id, ownerOrgId: w.org.owner.id });
    for (const who of [w.u.v1, w.u.funder, w.u.outsider, w.u.rivalMember, w.u.platformAdmin]) {
      await expect(createDraft(actor(who), w.project.id, tx)).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  scenario("a project that is not ACTIVE takes no new evidence", async (tx, w) => {
    await tx.update(impactProject).set({ status: "CLOSED" }).where(eq(impactProject.id, w.project.id));
    await expect(createDraft(actor(w.u.ownerMember), w.project.id, tx)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("issueUploadToken", () => {
  scenario("the server picks the path, inside this draft, and scopes the token to it and to 5 MB of images", async (tx, w, store) => {
    const draft = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
    const t = await issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
    expect(t.pathname).toMatch(new RegExp(`^org/${w.org.owner.id}/project/${w.project.id}/${draft.id}/before-[0-9a-f-]{36}\\.jpg$`));
    expect(store.tokens[0]).toEqual({ key: t.pathname, maxBytes: 5 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp"] });
  });

  scenario("HEIC is refused with a reason, other types are refused, and strangers get a 404", async (tx, w, store) => {
    const draft = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
    await expect(issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "BEFORE", contentType: "image/heic" }, tx, store.port)).rejects.toThrow(/HEIC/);
    await expect(issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "BEFORE", contentType: "application/pdf" }, tx, store.port)).rejects.toBeInstanceOf(ValidationError);
    await expect(issueUploadToken(actor(w.u.outsider), draft.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port)).rejects.toBeInstanceOf(NotFoundError);
    await expect(issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "SUPPLEMENT", contentType: "image/jpeg" }, tx, store.port)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("finalizeSubmission", () => {
  scenario("hashes the stored bytes, records the files, moves to PENDING_FORENSICS and queues one forensics job", async (tx, w, store) => {
    const { draft, before, after } = await uploaded(tx, w, store);
    const done = await finalizeSubmission(actor(w.u.ownerMember), draft.id, { files: [{ role: "BEFORE", pathname: before, clientSha256: sha(JPEG) }, { role: "AFTER", pathname: after }] }, tx, store.port);
    expect(done.status).toBe("PENDING_FORENSICS");

    const files = await tx.select().from(evidenceFile).where(eq(evidenceFile.submissionId, draft.id));
    expect(files.map((f) => [f.role, f.sha256, f.sizeBytes, f.round]).sort()).toEqual(
      [["AFTER", sha(PNG), PNG.length, 1], ["BEFORE", sha(JPEG), JPEG.length, 1]].sort(),
    );
    const jobs = await tx.select().from(job).where(eq(job.idempotencyKey, `forensics:${draft.id}:1`));
    expect(jobs.map((j) => [j.kind, j.payload])).toEqual([["forensics.run", { submissionId: draft.id, round: 1 }]]);
    expect(await tx.select().from(forensicFinding).where(eq(forensicFinding.submissionId, draft.id))).toEqual([]);
  });

  scenario("the type is judged by the bytes: a PNG uploaded under a .jpg name is stored as a PNG", async (tx, w, store) => {
    const { draft, before, after } = await uploaded(tx, w, store, PNG, PNG);
    expect(before.endsWith(".jpg")).toBe(true);
    await finalizeSubmission(actor(w.u.ownerMember), draft.id, { files: [{ role: "BEFORE", pathname: before }, { role: "AFTER", pathname: after }] }, tx, store.port);
    const [file] = await tx.select().from(evidenceFile).where(and(eq(evidenceFile.submissionId, draft.id), eq(evidenceFile.role, "BEFORE")));
    expect(file!.mime).toBe("image/png");
  });

  scenario("a wrong client hash is never trusted: the server's is stored and the mismatch becomes a MEDIUM finding", async (tx, w, store) => {
    const { draft, before, after } = await uploaded(tx, w, store);
    const lie = "f".repeat(64);
    await finalizeSubmission(actor(w.u.ownerMember), draft.id, { files: [{ role: "BEFORE", pathname: before, clientSha256: lie }, { role: "AFTER", pathname: after }] }, tx, store.port);
    const [file] = await tx.select().from(evidenceFile).where(and(eq(evidenceFile.submissionId, draft.id), eq(evidenceFile.role, "BEFORE")));
    expect([file!.sha256, file!.clientSha256]).toEqual([sha(JPEG), lie]);
    const findings = await tx.select().from(forensicFinding).where(eq(forensicFinding.submissionId, draft.id));
    expect(findings.map((f) => [f.kind, f.severity, f.evidenceFileId])).toEqual([["CLIENT_HASH_MISMATCH", "MEDIUM", file!.id]]);
    expect(findings[0]!.evidence).toEqual({ clientSha256: lie, serverSha256: sha(JPEG) });
  });

  scenario("over 5 MB, not an image, missing, or not this draft's file: refused, and nothing changes", async (tx, w, store) => {
    const { draft, before, after } = await uploaded(tx, w, store);
    const other = await uploaded(tx, w, store);
    const tryWith = (files: { role: "BEFORE" | "AFTER"; pathname: string }[]) =>
      expect(finalizeSubmission(actor(w.u.ownerMember), draft.id, { files }, tx, store.port)).rejects.toBeInstanceOf(ValidationError);

    store.put(after, new Uint8Array(5 * 1024 * 1024 + 1).fill(0xff));
    await tryWith([{ role: "BEFORE", pathname: before }, { role: "AFTER", pathname: after }]);
    store.put(after, new TextEncoder().encode("%PDF-1.7 not a photo"));
    await tryWith([{ role: "BEFORE", pathname: before }, { role: "AFTER", pathname: after }]);
    store.files.delete(after);
    await tryWith([{ role: "BEFORE", pathname: before }, { role: "AFTER", pathname: after }]);
    await tryWith([{ role: "BEFORE", pathname: before }, { role: "AFTER", pathname: other.after }]);
    await tryWith([{ role: "BEFORE", pathname: before }, { role: "BEFORE", pathname: before }]);

    const [row] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, draft.id));
    expect(row!.status).toBe("DRAFT");
    expect(await tx.select().from(evidenceFile).where(eq(evidenceFile.submissionId, draft.id))).toEqual([]);
  });

  scenario("only the owning organisation can finalize, and only a DRAFT", async (tx, w, store) => {
    const { draft, before, after } = await uploaded(tx, w, store);
    const files = { files: [{ role: "BEFORE" as const, pathname: before }, { role: "AFTER" as const, pathname: after }] };
    await expect(finalizeSubmission(actor(w.u.v1), draft.id, files, tx, store.port)).rejects.toBeInstanceOf(NotFoundError);
    await finalizeSubmission(actor(w.u.ownerMember), draft.id, files, tx, store.port);
    await expect(finalizeSubmission(actor(w.u.ownerMember), draft.id, files, tx, store.port)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("addSupplement", () => {
  scenario("from NEEDS_MORE_PROOF only: a new round, back IN_REVIEW, with a forensics pass for the new file", async (tx, w, store) => {
    await expect(addSupplement(actor(w.u.ownerMember), w.submission.id, { pathname: "x" }, tx, store.port)).rejects.toBeInstanceOf(ConflictError);
    await tx.update(evidenceSubmission).set({ status: "NEEDS_MORE_PROOF" }).where(eq(evidenceSubmission.id, w.submission.id));

    const t = await issueUploadToken(actor(w.u.ownerMember), w.submission.id, { role: "SUPPLEMENT", contentType: "image/jpeg" }, tx, store.port);
    store.put(t.pathname, JPEG);
    const s = await addSupplement(actor(w.u.ownerMember), w.submission.id, { pathname: t.pathname }, tx, store.port);
    expect([s.status, s.round]).toEqual(["IN_REVIEW", 2]);
    const [file] = await tx.select().from(evidenceFile).where(eq(evidenceFile.submissionId, w.submission.id));
    expect([file!.role, file!.round, file!.sha256]).toEqual(["SUPPLEMENT", 2, sha(JPEG)]);
    expect(await tx.select({ k: job.kind }).from(job).where(eq(job.idempotencyKey, `forensics:${w.submission.id}:2`))).toEqual([{ k: "forensics.run" }]);
  });
});

describe("sweepAbandonedDrafts", () => {
  scenario("removes drafts older than 24 hours that never finalized, with their uploads; keeps everything else", async (tx, w, store) => {
    const old = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
    const fresh = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
    const oldInReview = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id });
    const t = await issueUploadToken(actor(w.u.ownerMember), old.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
    store.put(t.pathname, JPEG); // uploaded, never finalized
    await tx.update(evidenceSubmission).set({ submittedAt: sql`now() - interval '25 hours'` }).where(sql`${evidenceSubmission.id} in (${old.id}, ${oldInReview.id})`);

    expect(await sweepAbandonedDrafts(tx, store.port)).toBe(1);
    const left = (await tx.select({ id: evidenceSubmission.id }).from(evidenceSubmission).where(eq(evidenceSubmission.projectId, w.project.id))).map((r) => r.id);
    expect(left).not.toContain(old.id);
    expect(left).toEqual(expect.arrayContaining([fresh.id, oldInReview.id, w.submission.id]));
    expect(store.files.has(t.pathname)).toBe(false);
  });
});
