// The 2026-11-14 additions against the database, with no network:
//   - claims.v1 writes one finding per submission from the project's own claim and boundary, and
//     replays byte for byte
//   - a survival check-up revisits only an approved record, takes one AFTER photo, links to the
//     original record on the audit chain, and shows reviewers the record's own photo beside it
//   - the check-up schedule can be set or shortened, never lengthened or removed once a record is
//     approved, and a missed visit reads "overdue"
//   - the public feed and batch reads show confirmed anchors only
//   - where email is configured, an unverified address is not an operator
import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { anchorBatch, anchorLeaf, auditEvent, evidenceSubmission, forensicFinding, projectAssignment, user } from "../../src/server/db/schema";
import { checkupsDueForOwner, checkupTarget, projectSurvival } from "../../src/server/services/checkups.service";
import { projectFeed, publicBatch } from "../../src/server/services/feeds.service";
import { replayForensics, runForensics } from "../../src/server/services/forensics.service";
import { isOperator } from "../../src/server/services/operators";
import { createProject, setCheckupSchedule, updateProject } from "../../src/server/services/projects.service";
import { reviewQueueOverview } from "../../src/server/services/reviews.service";
import { createCheckupDraft, createDraft, finalizeSubmission, issueUploadToken } from "../../src/server/services/submissions.service";
import { synthetic } from "../fixtures/forensics/images";
import { client, inRollback, type Tx } from "./db";
import { actor, asOperators, SQUARE, world, type World } from "./fixtures";
import { memoryStorage } from "./memory-storage";

afterAll(() => client.end());
process.env.FORENSICS_MATCH_KEY ||= "test-forensics-match-key-of-at-least-32-chars";

async function pair(tx: Tx, w: World, store: ReturnType<typeof memoryStorage>, projectId: string, seed: number) {
  const d = await createDraft(actor(w.u.ownerMember), projectId, tx);
  const b = await issueUploadToken(actor(w.u.ownerMember), d.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
  const a = await issueUploadToken(actor(w.u.ownerMember), d.id, { role: "AFTER", contentType: "image/jpeg" }, tx, store.port);
  store.put(b.pathname, await synthetic(seed));
  store.put(a.pathname, await synthetic(seed + 1));
  await finalizeSubmission(actor(w.u.ownerMember), d.id, { files: [{ role: "BEFORE", pathname: b.pathname }, { role: "AFTER", pathname: a.pathname }] }, tx, store.port);
  await runForensics(d.id, 1, tx, store.port);
  return d.id;
}

async function claimProject(tx: Tx, w: World, quantity: number, unit: string) {
  const p = await createProject(actor(w.u.ownerAdmin), { ownerOrgId: w.org.owner.id, title: `Claim ${w.tag} ${unit}`, activityType: "MANGROVE", boundary: SQUARE, claimedQuantity: quantity, claimedUnit: unit }, tx);
  await updateProject(actor(w.u.ownerAdmin), p.id, { status: "ACTIVE" }, tx);
  await tx.insert(projectAssignment).values({ projectId: p.id, verifierOrgId: w.org.verifier.id, assignedByUserId: w.u.platformAdmin.id });
  return p.id;
}

const approve = (tx: Tx, id: string, approvedAtIso?: string) =>
  tx.update(evidenceSubmission).set({ status: "APPROVED", ...(approvedAtIso ? { manifest: { approvedAtIso } } : {}) }).where(eq(evidenceSubmission.id, id));
const claimsOf = (tx: Tx, id: string) => tx.select().from(forensicFinding).where(and(eq(forensicFinding.submissionId, id), eq(forensicFinding.ruleVersion, "claims.v1")));

describe("the claim check (claims.v1)", () => {
  it("records an ordinary density as INFO, and a claim larger than the boundary as MEDIUM; both replay identically", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      // SQUARE is about 1.13 km², so 113 ha
      const plain = await pair(tx, w, store, await claimProject(tx, w, 12_000, "saplings"), 9100);
      const [ok] = await claimsOf(tx, plain);
      expect(ok).toMatchObject({ kind: "CLAIM_CHECKED", severity: "INFO", evidenceFileId: null });
      expect(ok!.reason).toMatch(/^12,000 saplings over 11\d(\.\d)? hectares is about 10\d per hectare/);
      expect((await replayForensics(plain, tx, store.port)).identical).toBe(true);

      const big = await pair(tx, w, store, await claimProject(tx, w, 500, "hectares"), 9110);
      const [flag] = await claimsOf(tx, big);
      expect(flag).toMatchObject({ kind: "CLAIM_EXCEEDS_AREA", severity: "MEDIUM" });
      expect(flag!.reason).toMatch(/^The claim is 500 hectares, but the registered boundary covers 11\d(\.\d)? hectares: 4\.\d times the area that was drawn\.$/);
      expect((await replayForensics(big, tx, store.port)).identical).toBe(true);

      // a project with no claim gets no claim finding, and a record checked before the rule existed is not re-judged by it
      expect(await claimsOf(tx, await pair(tx, w, store, w.project.id, 9120))).toHaveLength(0);
      await tx.delete(forensicFinding).where(eq(forensicFinding.submissionId, big));
      await runForensics(big, 1, tx, store.port);
      await tx.delete(forensicFinding).where(and(eq(forensicFinding.submissionId, big), eq(forensicFinding.ruleVersion, "claims.v1")));
      expect((await replayForensics(big, tx, store.port)).identical).toBe(true);
    }));
});

describe("a survival check-up", () => {
  it("revisits only an approved record of the caller's organisation, with one AFTER photo, linked on the audit chain", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      const record = await pair(tx, w, store, w.project.id, 9200);
      await expect(createCheckupDraft(actor(w.u.ownerMember), record, tx)).rejects.toThrow(/approved record/); // still IN_REVIEW
      await approve(tx, record);
      await expect(createCheckupDraft(actor(w.u.outsider), record, tx)).rejects.toThrow(/not found/);
      await expect(createCheckupDraft(actor(w.u.v1), record, tx)).rejects.toThrow(/not found/);

      const visit = await createCheckupDraft(actor(w.u.ownerMember), record, tx);
      expect(visit.followsSubmissionId).toBe(record);
      await expect(issueUploadToken(actor(w.u.ownerMember), visit.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port)).rejects.toThrow(/no BEFORE photo/);
      const t = await issueUploadToken(actor(w.u.ownerMember), visit.id, { role: "AFTER", contentType: "image/jpeg" }, tx, store.port);
      store.put(t.pathname, await synthetic(9210));
      await expect(finalizeSubmission(actor(w.u.ownerMember), visit.id, { files: [{ role: "BEFORE", pathname: t.pathname }, { role: "AFTER", pathname: `${t.pathname}x` }] }, tx, store.port)).rejects.toThrow(/exactly one new photo/);
      const sent = await finalizeSubmission(actor(w.u.ownerMember), visit.id, { files: [{ role: "AFTER", pathname: t.pathname }] }, tx, store.port);
      expect(sent.status).toBe("PENDING_FORENSICS");
      const events = await tx.select({ payload: auditEvent.payload }).from(auditEvent).where(and(eq(auditEvent.orgId, w.org.owner.id), eq(auditEvent.eventType, "SUBMISSION_FINALIZED")));
      expect(events.map((e) => e.payload)).toContainEqual(expect.objectContaining({ submissionId: visit.id, followsSubmissionId: record }));
      expect(await runForensics(visit.id, 1, tx, store.port)).toBe("done");

      // the reviewer sees the record's own after photo as the comparison
      const queue = await reviewQueueOverview(actor(w.u.v1), 100, tx);
      const item = queue.items.find((i) => i.id === visit.id)!;
      expect(item.files.map((f) => f.role)).toEqual(["AFTER"]);
      expect(item.reference).toMatchObject({ role: "AFTER", submissionId: record });

      // a check-up of the check-up revisits the original record
      await approve(tx, visit.id);
      expect((await createCheckupDraft(actor(w.u.ownerMember), visit.id, tx)).followsSubmissionId).toBe(record);
      expect(await checkupTarget(actor(w.u.ownerMember), visit.id, tx)).toMatchObject({ recordId: record, visits: 1, projectId: w.project.id });
    }));

  it("is due on the schedule the owner set, overdue once missed, and the schedule can only be shortened after approval", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      const record = await pair(tx, w, store, w.project.id, 9300);
      await expect(setCheckupSchedule(actor(w.u.ownerMember), w.project.id, 6, tx)).rejects.toThrow(/owner or admin/);
      await setCheckupSchedule(actor(w.u.ownerAdmin), w.project.id, 12, tx); // nothing approved yet: anything goes
      await setCheckupSchedule(actor(w.u.ownerAdmin), w.project.id, 6, tx);
      await approve(tx, record, "2026-01-10T09:00:00.000Z");
      await expect(setCheckupSchedule(actor(w.u.ownerAdmin), w.project.id, 12, tx)).rejects.toThrow(/never lengthened or removed/);
      await expect(setCheckupSchedule(actor(w.u.ownerAdmin), w.project.id, null, tx)).rejects.toThrow(/never lengthened or removed/);

      const at = (iso: string) => projectSurvival(w.project.id, { now: new Date(iso) }, tx);
      expect((await at("2026-03-01T00:00:00Z")).records[0]).toMatchObject({ recordId: record, state: "scheduled", nextDueAt: new Date("2026-07-10T09:00:00.000Z") });
      expect((await at("2026-06-20T00:00:00Z")).records[0]!.state).toBe("due");
      expect((await at("2026-08-01T00:00:00Z")).records[0]!.state).toBe("overdue");
      // the owner's to-do list, at today's date, long after July
      expect(await checkupsDueForOwner(actor(w.u.ownerAdmin), tx)).toEqual([expect.objectContaining({ recordId: record, state: "overdue", projectId: w.project.id })]);

      // a visit in review: the owner sees it in review; the public sees only approved visits
      const visit = await createCheckupDraft(actor(w.u.ownerMember), record, tx);
      const t = await issueUploadToken(actor(w.u.ownerMember), visit.id, { role: "AFTER", contentType: "image/jpeg" }, tx, store.port);
      store.put(t.pathname, await synthetic(9310));
      await finalizeSubmission(actor(w.u.ownerMember), visit.id, { files: [{ role: "AFTER", pathname: t.pathname }] }, tx, store.port);
      expect((await projectSurvival(w.project.id, { includePending: true, now: new Date("2026-08-01T00:00:00Z") }, tx)).records[0]!.state).toBe("in-review");
      expect((await projectSurvival(w.project.id, { now: new Date("2026-08-01T00:00:00Z") }, tx)).records[0]).toMatchObject({ state: "overdue", visits: [] });
      // shortening stays allowed, and is on the chain
      await setCheckupSchedule(actor(w.u.ownerAdmin), w.project.id, 3, tx);
      const [set] = await tx.select({ payload: auditEvent.payload }).from(auditEvent).where(and(eq(auditEvent.orgId, w.org.owner.id), eq(auditEvent.eventType, "CHECKUP_SCHEDULE_SET"))).orderBy(asc(auditEvent.seq));
      expect(set!.payload).toMatchObject({ projectId: w.project.id, from: null, to: 12 });
    }));
});

describe("the public feeds", () => {
  it("list a project's anchored records and a confirmed batch's leaves, and nothing pending", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      const record = await pair(tx, w, store, w.project.id, 9400);
      await tx.update(evidenceSubmission).set({ status: "ANCHORED", manifest: { approvedAtIso: "2026-11-14T09:00:00.000Z" }, manifestHash: "a".repeat(64) }).where(eq(evidenceSubmission.id, record));
      const [confirmed] = await tx
        .insert(anchorBatch)
        .values({ merkleRoot: `0x${"b".repeat(64)}`, chainId: 84532, contractAddress: `0x${"1".repeat(40)}`, status: "CONFIRMED", leafCount: 1, confirmedAt: new Date("2026-11-15T00:00:00Z"), txHash: `0x${"c".repeat(64)}` })
        .returning();
      await tx.insert(anchorLeaf).values({ batchId: confirmed!.id, submissionId: record, manifestHash: "a".repeat(64), manifestVersion: 1, leafIndex: 0, proof: [] });
      const [pending] = await tx.insert(anchorBatch).values({ merkleRoot: `0x${"d".repeat(64)}`, chainId: 84532, contractAddress: `0x${"1".repeat(40)}`, status: "PENDING", leafCount: 0 }).returning();

      const feed = await projectFeed(w.project.id, 50, tx);
      expect(feed.entries).toEqual([expect.objectContaining({ submissionId: record, batchId: confirmed!.id, manifestHash: "a".repeat(64), approvedAtIso: "2026-11-14T09:00:00.000Z", followsSubmissionId: null })]);
      expect(await publicBatch(confirmed!.id, tx)).toMatchObject({ leafCount: 1, leaves: [{ leafIndex: 0, submissionId: record, manifestHash: "a".repeat(64), approvedAtIso: "2026-11-14T09:00:00.000Z" }] });
      await expect(publicBatch(pending!.id, tx)).rejects.toThrow(/not found/);
      const draft = await createProject(actor(w.u.ownerAdmin), { ownerOrgId: w.org.owner.id, title: "Draft", activityType: "WETLAND", boundary: SQUARE }, tx);
      await expect(projectFeed(draft.id, 50, tx)).rejects.toThrow(/not found/);
    }));
});

describe("operators where email is configured", () => {
  it("counts an address only once its owner has confirmed it", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const before = process.env.EMAIL_OUTBOX_DIR;
      process.env.EMAIL_OUTBOX_DIR = ".local/test-outbox";
      try {
        await asOperators([w.u.platformAdmin], async () => {
          expect(await isOperator(actor(w.u.platformAdmin), tx)).toBe(false);
          await tx.update(user).set({ emailVerified: true }).where(eq(user.id, w.u.platformAdmin.id));
          expect(await isOperator(actor(w.u.platformAdmin), tx)).toBe(true);
        });
      } finally {
        if (before === undefined) delete process.env.EMAIL_OUTBOX_DIR;
        else process.env.EMAIL_OUTBOX_DIR = before;
      }
    }));
});
