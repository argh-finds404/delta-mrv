// The forensics pipeline (docs/10-FORENSICS.md): severities from the §3 table, the severity
// rule that matters, EXIF and geofence outcomes, the pair check, idempotency, replay (#12),
// the score cache, and the seed pool hashing the same through the service as through the seed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { makePool } from "../../scripts/lib/seed-pool";
import { evidenceFile, evidenceSubmission, forensicFinding, job, member } from "../../src/server/db/schema";
import { dHashOf, replayForensics, runForensics } from "../../src/server/services/forensics.service";
import { runOneJob } from "../../src/server/services/jobs.service";
import { createProject, updateProject } from "../../src/server/services/projects.service";
import { addSupplement, createDraft, finalizeSubmission, issueUploadToken } from "../../src/server/services/submissions.service";
import { synthetic } from "../fixtures/forensics/images";
import { withExif } from "../fixtures/forensics/exif";
import { client, inRollback, type Tx } from "./db";
import { actor, SQUARE, world, type World } from "./fixtures";
import { memoryStorage } from "./memory-storage";

const h = vi.hoisted(() => ({ store: null as null | { port: unknown } }));
// the job handler runs with the default store; point it at the test's
vi.mock("../../src/server/storage/blob", () => ({
  get blobStorage() {
    return h.store!.port;
  },
}));

process.env.FORENSICS_MATCH_KEY = "test-forensics-match-key-of-at-least-32-chars";
afterAll(() => client.end());

type Store = ReturnType<typeof memoryStorage>;
const scenario = (name: string, fn: (tx: Tx, w: World, store: Store) => Promise<void>) =>
  it(name, () =>
    inRollback(async (tx) => {
      const store = memoryStorage();
      h.store = store;
      await fn(tx, await world(tx), store);
    }),
  );

/** BEFORE and AFTER through the real intake, as a member of the project's org would. */
async function submitPair(tx: Tx, store: Store, who: { id: string }, projectId: string, before: Buffer, after: Buffer) {
  const draft = await createDraft(actor(who), projectId, tx);
  const b = await issueUploadToken(actor(who), draft.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
  const a = await issueUploadToken(actor(who), draft.id, { role: "AFTER", contentType: "image/jpeg" }, tx, store.port);
  store.put(b.pathname, before);
  store.put(a.pathname, after);
  await finalizeSubmission(actor(who), draft.id, { files: [{ role: "BEFORE", pathname: b.pathname }, { role: "AFTER", pathname: a.pathname }] }, tx, store.port);
  return draft.id;
}

/** One transaction has one now(); production finalizes in separate ones. Age a submission's files. */
const backdate = (tx: Tx, submissionId: string, minutes: number) =>
  tx.update(evidenceFile).set({ createdAt: sql`now() - make_interval(mins => ${minutes})` }).where(eq(evidenceFile.submissionId, submissionId));

const findings = async (tx: Tx, submissionId: string) =>
  (await tx.select().from(forensicFinding).where(eq(forensicFinding.submissionId, submissionId))).map((f) => ({ ...f, evidence: f.evidence as Record<string, unknown> }));
const fileOf = async (tx: Tx, submissionId: string, role: "BEFORE" | "AFTER" | "SUPPLEMENT") =>
  (await tx.select().from(evidenceFile).where(eq(evidenceFile.submissionId, submissionId))).find((f) => f.role === role)!;

/** A second ACTIVE project: in the owner org, or in the unrelated `other` org. */
async function projectIn(tx: Tx, w: World, org: "owner" | "other") {
  const admin = org === "owner" ? w.u.ownerAdmin : w.u.outsider;
  if (org === "other") await tx.update(member).set({ role: "admin" }).where(eq(member.userId, w.u.outsider.id));
  const p = await createProject(actor(admin), { ownerOrgId: w.org[org].id, title: `Second ${org} ${w.tag}`, activityType: "MANGROVE", boundary: SQUARE }, tx);
  await updateProject(actor(admin), p.id, { status: "ACTIVE" }, tx);
  return { project: p, submitter: org === "owner" ? w.u.ownerMember : w.u.outsider };
}

let IMG: Buffer;
let NEAR: Buffer;
beforeAll(async () => {
  IMG = await synthetic(6100);
  NEAR = await sharp(IMG).jpeg({ quality: 50 }).toBuffer(); // other bytes, same picture
});

describe("the seed pool", () => {
  it("hashes through the service, read back from storage, to the dHash the database holds", () =>
    inRollback(async (tx) => {
      const store = memoryStorage();
      for (const img of await makePool()) {
        store.put(img.key, img.jpeg);
        const stored = await store.port.get(img.key);
        const fromService = await dHashOf(new Uint8Array(await new Response(stored!.stream).arrayBuffer()));
        const inDb = await tx.selectDistinct({ dhash: evidenceFile.dhash }).from(evidenceFile).where(eq(evidenceFile.storageKey, img.key));
        expect(inDb.length, `no seeded rows for ${img.key}: run pnpm db:seed on this database`).toBe(1);
        expect(fromService).toBe(inDb[0]!.dhash);
      }
    }));
});

describe("runForensics", () => {
  scenario("the Stage 4 gate: a seeded pool image submitted again is a HIGH finding, and the band reads concern", async (tx, w, store) => {
    const [pooled] = await makePool();
    const id = await submitPair(tx, store, w.u.ownerMember, w.project.id, pooled!.jpeg, await synthetic(6001));
    expect(await runForensics(id, 1, tx, store.port)).toBe("done");

    const before = await fileOf(tx, id, "BEFORE");
    const all = await findings(tx, id);
    const dup = all.find((f) => f.kind === "EXACT_DUPLICATE_OTHER_ORG");
    expect(dup).toMatchObject({ severity: "HIGH", evidenceFileId: before.id, ruleVersion: "forensics.v1" });
    expect(Object.keys(dup!.evidence).sort()).toEqual(["matchRef", "ruleVersion", "sha256"]);
    // neither photo has EXIF: stripped and no position, each LOW, never more
    expect(all.filter((f) => f.kind === "EXIF_FULLY_STRIPPED" || f.kind === "GPS_MISSING").map((f) => f.severity)).toEqual(["LOW", "LOW", "LOW", "LOW"]);

    const [s] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id));
    const expected = all.reduce((n, f) => n + { INFO: 0, LOW: 1, MEDIUM: 4, HIGH: 12 }[f.severity], 0);
    expect([s!.status, s!.riskBand, s!.scoringVersion, Number(s!.riskScore)]).toEqual(["IN_REVIEW", "concern", "scoring.v1", expected]);
  });

  scenario("same project is LOW, same organisation other project is HIGH, other organisation is HIGH: exact and near", async (tx, w, store) => {
    const sameOrg = await projectIn(tx, w, "owner");
    const otherOrg = await projectIn(tx, w, "other");
    const priors = [
      await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6101)),
      await submitPair(tx, store, sameOrg.submitter, sameOrg.project.id, IMG, await synthetic(6102)),
      await submitPair(tx, store, otherOrg.submitter, otherOrg.project.id, IMG, await synthetic(6103)),
    ];
    for (const p of priors) await backdate(tx, p, 60);

    const exact = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6104));
    await runForensics(exact, 1, tx, store.port);
    const ex = (await findings(tx, exact)).filter((f) => f.kind.startsWith("EXACT_") || f.kind.startsWith("PERCEPTUAL_"));
    expect(ex.map((f) => [f.kind, f.severity]).sort()).toEqual([
      ["EXACT_DUPLICATE_OTHER_ORG", "HIGH"],
      ["EXACT_DUPLICATE_SAME_ORG", "HIGH"],
      ["EXACT_DUPLICATE_SAME_PROJECT", "LOW"],
    ]);

    await backdate(tx, exact, 30);
    const near = await submitPair(tx, store, w.u.ownerMember, w.project.id, NEAR, await synthetic(6105));
    await runForensics(near, 1, tx, store.port);
    const ne = (await findings(tx, near)).filter((f) => f.kind.startsWith("EXACT_") || f.kind.startsWith("PERCEPTUAL_"));
    expect(ne.map((f) => [f.kind, f.severity]).sort()).toEqual([
      ["PERCEPTUAL_MATCH_OTHER_ORG", "HIGH"],
      ["PERCEPTUAL_MATCH_SAME_ORG", "HIGH"],
      ["PERCEPTUAL_MATCH_SAME_PROJECT", "LOW"],
    ]);
    for (const f of ne) expect(f.evidence.distance as number).toBeLessThan(8);
  });

  scenario("only earlier files count: the original is not flagged by the copy made after it", async (tx, w, store) => {
    const original = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6110));
    await backdate(tx, original, 60);
    await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6111));
    await runForensics(original, 1, tx, store.port);
    expect((await findings(tx, original)).filter((f) => f.kind.startsWith("EXACT_"))).toEqual([]);
  });

  scenario("a pair showing the same scene is NO_VISIBLE_CHANGE on the AFTER photo; a real change is not", async (tx, w, store) => {
    const same = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, NEAR);
    await runForensics(same, 1, tx, store.port);
    const nvc = (await findings(tx, same)).filter((f) => f.kind === "NO_VISIBLE_CHANGE");
    expect(nvc.map((f) => [f.severity, f.evidenceFileId])).toEqual([["MEDIUM", (await fileOf(tx, same, "AFTER")).id]]);
    expect(nvc[0]!.evidence.distance as number).toBeLessThan(4);

    const changed = await submitPair(tx, store, w.u.ownerMember, w.project.id, await synthetic(6120), await synthetic(6121));
    await runForensics(changed, 1, tx, store.port);
    expect((await findings(tx, changed)).filter((f) => f.kind === "NO_VISIBLE_CHANGE")).toEqual([]);
  });

  scenario("EXIF and position: inside, within tolerance, outside with the distance, missing; time missing or implausible", async (tx, w, store) => {
    const a = await submitPair(
      tx,
      store,
      w.u.ownerMember,
      w.project.id,
      // a BEFORE photo from before the project existed is a baseline: not flagged
      withExif(await synthetic(6200), { make: "Canon", dateTimeOriginal: "2024:05:01 10:20:30", gps: { lat: 23.805, lon: 90.405 } }),
      withExif(await synthetic(6201), { dateTimeOriginal: "2024:05:01 10:20:30", offsetTimeOriginal: "+06:00", gps: { lat: 24.5, lon: 91.5 } }),
    );
    await runForensics(a, 1, tx, store.port);
    const [aBefore, aAfter] = [await fileOf(tx, a, "BEFORE"), await fileOf(tx, a, "AFTER")];
    const fa = await findings(tx, a);
    const on = (fileId: string) => fa.filter((f) => f.evidenceFileId === fileId).map((f) => [f.kind, f.severity]).sort();
    expect(on(aBefore.id)).toEqual([["GPS_INSIDE_BOUNDARY", "INFO"]]);
    expect(on(aAfter.id)).toEqual([["EXIF_TIMESTAMP_IMPLAUSIBLE", "MEDIUM"], ["GPS_OUTSIDE_BOUNDARY", "MEDIUM"]]);
    const outside = fa.find((f) => f.kind === "GPS_OUTSIDE_BOUNDARY")!;
    expect(outside.evidence.distanceMeters as number).toBeGreaterThan(50_000);
    expect(outside.evidence.toleranceMeters).toBe(100);
    // what was read is recorded as read: no offset means no instant, an offset gives one
    expect([aBefore.exif, aBefore.capturedAt, aBefore.gps?.coordinates]).toEqual([{ make: "Canon", dateTimeOriginal: "2024:05:01 10:20:30" }, null, [90.405, 23.805]]);
    expect(aAfter.capturedAt?.toISOString()).toBe("2024-05-01T04:20:30.000Z");

    const b = await submitPair(
      tx,
      store,
      w.u.ownerMember,
      w.project.id,
      withExif(await synthetic(6202), { make: "Pixel", gps: { lat: 23.8104, lon: 90.405 } }), // ~44 m north of the boundary
      withExif(await synthetic(6203), { dateTimeOriginal: "2099:01:01 00:00:00" }),
    );
    await runForensics(b, 1, tx, store.port);
    const fb = await findings(tx, b);
    const [bBefore, bAfter] = [await fileOf(tx, b, "BEFORE"), await fileOf(tx, b, "AFTER")];
    const onB = (fileId: string) => fb.filter((f) => f.evidenceFileId === fileId).map((f) => [f.kind, f.severity]).sort();
    expect(onB(bBefore.id)).toEqual([["EXIF_TIMESTAMP_MISSING", "LOW"], ["GPS_WITHIN_TOLERANCE", "INFO"]]);
    expect(onB(bAfter.id)).toEqual([["EXIF_TIMESTAMP_IMPLAUSIBLE", "MEDIUM"], ["GPS_MISSING", "LOW"]]);
  });

  scenario("runs once: a second run of the same round writes nothing", async (tx, w, store) => {
    const id = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6300));
    expect(await runForensics(id, 1, tx, store.port)).toBe("done");
    const n = (await findings(tx, id)).length;
    expect(await runForensics(id, 1, tx, store.port)).toBe("already-done");
    expect((await findings(tx, id)).length).toBe(n);
  });

  scenario("a supplement is its own round, and the score covers every round", async (tx, w, store) => {
    const id = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6400));
    await runForensics(id, 1, tx, store.port);
    await tx.update(evidenceSubmission).set({ status: "NEEDS_MORE_PROOF" }).where(eq(evidenceSubmission.id, id));
    const t = await issueUploadToken(actor(w.u.ownerMember), id, { role: "SUPPLEMENT", contentType: "image/jpeg" }, tx, store.port);
    store.put(t.pathname, withExif(await synthetic(6401), { gps: { lat: 24.5, lon: 91.5 } }));
    await addSupplement(actor(w.u.ownerMember), id, { pathname: t.pathname }, tx, store.port);
    expect(await runForensics(id, 2, tx, store.port)).toBe("done");

    const supplement = await fileOf(tx, id, "SUPPLEMENT");
    const all = await findings(tx, id);
    expect(all.filter((f) => f.evidenceFileId === supplement.id).map((f) => f.kind)).toContain("GPS_OUTSIDE_BOUNDARY");
    const [s] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id));
    expect(s!.status).toBe("IN_REVIEW");
    expect(Number(s!.riskScore)).toBe(all.reduce((n, f) => n + { INFO: 0, LOW: 1, MEDIUM: 4, HIGH: 12 }[f.severity], 0));
  });

  scenario("a recorded file with no stored bytes fails the run loudly and writes nothing", async (tx, w, store) => {
    const id = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6500));
    store.files.delete((await fileOf(tx, id, "AFTER")).storageKey);
    await expect(runForensics(id, 1, tx, store.port)).rejects.toThrow(/no stored bytes/);
    expect(await findings(tx, id)).toEqual([]);
    const [s] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id));
    expect(s!.status).toBe("PENDING_FORENSICS");
  });

  scenario("the queue runs it: finalize queues forensics.run and the handler moves the submission on", async (tx, w, store) => {
    const id = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6600));
    const [queued] = await tx.select().from(job).where(eq(job.idempotencyKey, `forensics:${id}:1`));
    expect(await runOneJob(tx, { kinds: ["forensics.run"] })).toEqual({ id: queued!.id, outcome: "done" });
    const [s] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id));
    expect(s!.status).toBe("IN_REVIEW");
  });

  scenario("Content Credentials (X9): records a verified C2PA manifest on the signed photo and replays identically", async (tx, w, store) => {
    const signed = readFileSync(path.join(process.cwd(), "test/fixtures/forensics/c2pa-signed.jpg"));
    const id = await submitPair(tx, store, w.u.ownerMember, w.project.id, signed, await synthetic(6650));
    expect(await runForensics(id, 1, tx, store.port)).toBe("done");
    const before = await fileOf(tx, id, "BEFORE");
    const c2pa = (await findings(tx, id)).filter((f) => f.kind === "CONTENT_CREDENTIALS");
    expect(c2pa).toHaveLength(1);
    expect(c2pa[0]).toMatchObject({
      evidenceFileId: before.id,
      severity: "INFO",
      ruleVersion: "c2pa.v1",
      evidence: {
        ruleVersion: "c2pa.v1",
        c2pa: {
          outcome: "valid",
          signer: "C2PA Signer",
          issuer: "C2PA Test Signing Cert",
          alg: "Ps256",
        },
      },
    });
    const replay = await replayForensics(id, tx, store.port);
    expect(replay.identical).toBe(true);
  });

  scenario("Content Credentials (X9): a photo that names a remote manifest is recorded as remote, never fetched, and replays identically", async (tx, w, store) => {
    const remote = readFileSync(path.join(process.cwd(), "test/fixtures/forensics/c2pa-remote.jpg"));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("forensics must not fetch"));
    try {
      const id = await submitPair(tx, store, w.u.ownerMember, w.project.id, remote, await synthetic(6660));
      expect(await runForensics(id, 1, tx, store.port)).toBe("done");
      const before = await fileOf(tx, id, "BEFORE");
      const c2pa = (await findings(tx, id)).filter((f) => f.kind === "CONTENT_CREDENTIALS");
      expect(c2pa).toEqual([
        expect.objectContaining({ evidenceFileId: before.id, severity: "INFO", evidence: { ruleVersion: "c2pa.v1", c2pa: { outcome: "remote", host: "cai-manifests.adobe.com" } } }),
      ]);
      expect((await replayForensics(id, tx, store.port)).identical).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("replayForensics (#12)", () => {
  scenario("re-reads the stored bytes and reproduces every finding byte for byte; an edited finding is caught", async (tx, w, store) => {
    const prior = await submitPair(tx, store, w.u.ownerMember, w.project.id, IMG, await synthetic(6700));
    await backdate(tx, prior, 60);
    const id = await submitPair(
      tx,
      store,
      w.u.ownerMember,
      w.project.id,
      withExif(NEAR, { make: "Canon", dateTimeOriginal: "2024:05:01 10:20:30", offsetTimeOriginal: "+06:00", gps: { lat: 23.8104, lon: 90.405 } }),
      withExif(await synthetic(6701), { gps: { lat: 24.5, lon: 91.5 } }),
    );
    await runForensics(id, 1, tx, store.port);
    const first = await replayForensics(id, tx, store.port);
    expect(first.stored.length).toBeGreaterThan(3);
    expect(first.identical).toBe(true);
    expect(first.expected).toEqual(first.stored);

    const [one] = await findings(tx, id);
    await tx.update(forensicFinding).set({ evidence: { ...one!.evidence, distanceMeters: 1 } }).where(eq(forensicFinding.id, one!.id));
    expect((await replayForensics(id, tx, store.port)).identical).toBe(false);
  });
});
