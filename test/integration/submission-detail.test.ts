// /submissions/[id] (docs/14-PAGE-SPEC.md §7): the full record of one submission.
//   - the owner organisation and an assigned verifier organisation get it; everyone else a 404,
//     a linked funder included (their view is the public proof page)
//   - it carries the files' real fingerprints and this submission's audit events, nothing else's
//   - it never carries a verdict: an open round's decisions stay hidden until the caller votes (A4)
//   - the Lab's queue names the latest before and after photo of a record in a later round
import { afterAll, describe, expect, it } from "vitest";
import { evidenceFile, evidenceSubmission, projectFunder } from "../../src/server/db/schema";
import { NotFoundError } from "../../src/server/services/errors";
import { castDecision, reviewQueueOverview } from "../../src/server/services/reviews.service";
import { getSubmissionDetail } from "../../src/server/services/submissions.service";
import { eq } from "drizzle-orm";
import { client, inRollback, type Tx } from "./db";
import { actor, addSubmission, INSIDE_SQUARE, REASON, world, type World } from "./fixtures";

afterAll(() => client.end());

const sha = (c: string) => c.repeat(64);

async function addPair(tx: Tx, w: World, submissionId = w.submission.id) {
  await tx.insert(evidenceFile).values([
    { submissionId, role: "BEFORE", storageKey: `detail/${w.tag}/${submissionId}/before`, mime: "image/jpeg", sizeBytes: 11, sha256: sha("a"), round: 1, gps: INSIDE_SQUARE, capturedAt: new Date("2026-03-01T04:00:00Z"), exif: { make: "Test", model: "Camera" } },
    { submissionId, role: "AFTER", storageKey: `detail/${w.tag}/${submissionId}/after`, mime: "image/jpeg", sizeBytes: 12, sha256: sha("b"), round: 1 },
  ]);
}

describe("getSubmissionDetail", () => {
  it("gives the owner and an assigned verifier the whole record, and never another reviewer's verdict", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await addPair(tx, w);
      const other = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id });
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);
      await castDecision(actor(w.u.v1), other.id, { decision: "REJECT", reason: REASON }, tx);

      const forOwner = await getSubmissionDetail(actor(w.u.ownerMember), w.submission.id, tx);
      expect(forOwner).toMatchObject({ access: "owner", submission: { id: w.submission.id, status: "IN_REVIEW" }, project: { id: w.project.id, title: w.project.title, ownerOrgName: w.org.owner.name } });
      expect(forOwner.files.map((f) => [f.role, f.sha256])).toEqual([["BEFORE", sha("a")], ["AFTER", sha("b")]]);
      expect(forOwner.files[0]).toMatchObject({ gps: INSIDE_SQUARE, exif: { make: "Test", model: "Camera" }, sizeBytes: 11 });
      expect(forOwner.files[1]).toMatchObject({ gps: null, capturedAt: null, exif: null });
      // this submission's events only: the other submission's decision is on the same chain
      expect(forOwner.events.map((e) => e.eventType)).toEqual(["REVIEW_DECISION"]);
      expect(forOwner.events[0]!.eventHash).toMatch(/^[0-9a-f]{64}$/);

      const forV2 = await getSubmissionDetail(actor(w.u.v2), w.submission.id, tx);
      expect(forV2.access).toBe("verifier");
      // v2 has not voted: nothing in the record says how v1 did
      expect(JSON.stringify(forV2)).not.toContain("APPROVE");
      expect(JSON.stringify(forV2)).not.toContain(REASON);
    }));

  it("is a 404 for everyone else, a linked funder included, and hides a draft from its reviewers", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      for (const who of [w.u.rivalMember, w.u.rivalAdmin, w.u.funder, w.u.outsider, w.u.platformAdmin]) {
        await expect(getSubmissionDetail(actor(who), w.submission.id, tx)).rejects.toBeInstanceOf(NotFoundError);
      }
      await expect(getSubmissionDetail(actor(w.u.ownerMember), "not-a-uuid", tx)).rejects.toBeInstanceOf(NotFoundError);

      // an approved record of a project the funder is linked to: theirs to read on the proof page, not here
      await tx.insert(projectFunder).values({ projectId: w.project.id, funderOrgId: w.org.funder.id, createdByUserId: w.u.ownerAdmin.id });
      await tx.update(evidenceSubmission).set({ status: "APPROVED" }).where(eq(evidenceSubmission.id, w.submission.id));
      await expect(getSubmissionDetail(actor(w.u.funder), w.submission.id, tx)).rejects.toBeInstanceOf(NotFoundError);

      const draft = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status: "DRAFT" });
      expect((await getSubmissionDetail(actor(w.u.ownerMember), draft.id, tx)).submission.status).toBe("DRAFT");
      await expect(getSubmissionDetail(actor(w.u.v1), draft.id, tx)).rejects.toBeInstanceOf(NotFoundError);
    }));
});

describe("the Lab's queue, for a record in a later round", () => {
  it("still names the before and after photo, with their real fingerprints, and the supplement", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await addPair(tx, w);
      // more proof was asked for and sent: the record is in round 2, its pair still belongs to round 1
      await tx.insert(evidenceFile).values({ submissionId: w.submission.id, role: "SUPPLEMENT", storageKey: `detail/${w.tag}/supplement`, mime: "image/jpeg", sizeBytes: 13, sha256: sha("c"), round: 2 });
      await tx.update(evidenceSubmission).set({ round: 2 }).where(eq(evidenceSubmission.id, w.submission.id));

      const item = (await reviewQueueOverview(actor(w.u.v1), 100, tx)).items.find((i) => i.id === w.submission.id)!;
      expect(item.round).toBe(2);
      expect(item.files.map((f) => [f.role, f.round, f.sha256])).toEqual([["BEFORE", 1, sha("a")], ["AFTER", 1, sha("b")], ["SUPPLEMENT", 2, sha("c")]]);
      expect(item.files[0]).toMatchObject({ gps: INSIDE_SQUARE, capturedAt: new Date("2026-03-01T04:00:00Z") });
    }));
});
