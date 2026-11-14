// /admin, the operators' page (src/server/services/operators.ts):
//   - only an operator (OPERATOR_EMAILS) may open any of it; a verifier-organisation admin may not
//   - the tamper demo edits a copy, never the stored chain, and names the exact event it changed
//   - reviewers are assigned by an operator, never by the organisation that reviews; an operator
//     who belongs to the owning organisation cannot choose its reviewer; the assignment is on the
//     owner's audit chain
//   - an owner can ask for a reviewer once; the request assigns nothing
//   - the job queue (M6): what has stopped is listed, and one press puts it back in the queue
//   - matchRef resolution: an operator sees both sides; the recorded conclusion names neither
//     side to the flagged submission's readers
import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auditEvent, evidenceFile, forensicFinding, impactProject, job, member, projectAssignment } from "../../src/server/db/schema";
import {
  assignReviewer,
  auditChainHealth,
  jobQueueHealth,
  lookupMatchRef,
  resolveMatchRef,
  retryHaltedJobs,
  tamperDemo,
  unassignedProjects,
  verifierOrganisations,
} from "../../src/server/services/admin.service";
import { verifyChainRows } from "../../src/server/services/audit-chain.service";
import { ConflictError, ConflictOfInterestError, ForbiddenError, NotFoundError, ValidationError } from "../../src/server/services/errors";
import { matchRef } from "../../src/server/services/forensics.service";
import { createProject, requestReviewer, reviewerRequestedAt, updateProject } from "../../src/server/services/projects.service";
import { castDecision } from "../../src/server/services/reviews.service";
import { listFindings } from "../../src/server/services/submissions.service";
import { client, inRollback } from "./db";
import { actor, addSubmission, asOperators, REASON, SQUARE, world } from "./fixtures";

process.env.FORENSICS_MATCH_KEY ||= "test-forensics-match-key-of-at-least-32-chars";

afterAll(() => client.end());

describe("audit chains on /admin", () => {
  it("are verified for an operator and nobody else; the tamper demo finds the edited event and stores nothing", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      // three events on the owner's chain: the project opening, and two decisions
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);
      await castDecision(actor(w.u.v2), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);

      // a verifier organisation's admin is not an operator
      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.vAdmin, w.u.funder, w.u.platformAdmin]) {
        await expect(auditChainHealth(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
      }
      await asOperators([w.u.platformAdmin], async () => {
        const health = await auditChainHealth(actor(w.u.platformAdmin), tx);
        expect(health.find((h) => h.orgId === w.org.owner.id)).toMatchObject({ orgName: w.org.owner.name, events: 3, ok: true, firstBadSeq: null });
        // the list is matched by address, so case and spaces do not matter
        process.env.OPERATOR_EMAILS = ` , ${w.u.platformAdmin.email.toUpperCase()} `;
        await expect(auditChainHealth(actor(w.u.platformAdmin), tx)).resolves.toBeDefined();
      });

      const before = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      const demo = await asOperators([w.u.platformAdmin], () => tamperDemo(actor(w.u.platformAdmin), tx).catch((e: unknown) => e));
      // DEMO_MODE is read once at boot: the demo exists only where the server was started with it
      if (process.env.DEMO_MODE === "true") {
        expect(demo).toMatchObject({ before: { ok: true }, after: { ok: false } });
        const d = demo as Awaited<ReturnType<typeof tamperDemo>>;
        expect(d.after.firstBadSeq).toBe(d.tamperedSeq);
      } else {
        expect(demo).toBeInstanceOf(NotFoundError);
      }
      // whatever the demo did, the stored chain is byte for byte what it was, and still verifies
      const after = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(after).toEqual(before);
      expect(verifyChainRows(after)).toMatchObject({ ok: true });
    }));
});

describe("assigning a reviewer", () => {
  it("is an operator's act, never the reviewing organisation's own, and is written to the owner's audit chain", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const op = actor(w.u.platformAdmin);
      const fresh = await createProject(actor(w.u.ownerAdmin), { ownerOrgId: w.org.owner.id, title: `Unreviewed ${w.tag}`, activityType: "WETLAND", boundary: SQUARE }, tx);
      await updateProject(actor(w.u.ownerAdmin), fresh.id, { status: "ACTIVE" }, tx);

      // nobody who is not listed, a verifier organisation's admin included: the self-assignment hole is closed
      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.vAdmin, w.u.rivalAdmin, w.u.funder, w.u.platformAdmin]) {
        await expect(assignReviewer(actor(who), fresh.id, w.org.verifier.id, tx)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(unassignedProjects(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(verifierOrganisations(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
      }

      await asOperators([w.u.platformAdmin, w.u.rivalAdmin], async () => {
        const waiting = (await unassignedProjects(op, tx)).map((p) => p.id);
        expect(waiting).toContain(fresh.id);
        expect(waiting).not.toContain(w.project.id); // the fixture's project already has a reviewer
        expect((await verifierOrganisations(op, tx)).map((o) => o.id)).toEqual(expect.arrayContaining([w.org.verifier.id, w.org.rival.id]));
        expect((await verifierOrganisations(op, tx)).map((o) => o.id)).not.toContain(w.org.owner.id);

        await expect(assignReviewer(op, "00000000-0000-4000-8000-000000000000", w.org.verifier.id, tx)).rejects.toBeInstanceOf(NotFoundError);
        // an owner organisation is not a reviewer
        await expect(assignReviewer(op, fresh.id, w.org.owner.id, tx)).rejects.toBeInstanceOf(ValidationError);
        // an operator who also belongs to the owner cannot choose the owner's auditor
        await tx.insert(member).values({ organizationId: w.org.owner.id, userId: w.u.rivalAdmin.id, role: "member", createdAt: new Date() });
        await expect(assignReviewer(actor(w.u.rivalAdmin), fresh.id, w.org.rival.id, tx)).rejects.toBeInstanceOf(ConflictOfInterestError);
        expect(await tx.select().from(projectAssignment).where(eq(projectAssignment.projectId, fresh.id))).toEqual([]);

        await assignReviewer(op, fresh.id, w.org.verifier.id, tx);
        await expect(assignReviewer(op, fresh.id, w.org.verifier.id, tx)).rejects.toBeInstanceOf(ConflictError);
        expect((await unassignedProjects(op, tx)).map((p) => p.id)).not.toContain(fresh.id);
      });
      const events = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(events.at(-1)).toMatchObject({ eventType: "VERIFIER_ASSIGNED", actorUserId: w.u.platformAdmin.id, payload: { projectId: fresh.id, verifierOrgId: w.org.verifier.id } });
      expect(verifyChainRows(events)).toMatchObject({ ok: true });

      // and it does what it is for: that organisation's reviewers can now decide on the project
      const s = await addSubmission(tx, { projectId: fresh.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id });
      expect(await castDecision(actor(w.u.v1), s.id, { decision: "APPROVE", reason: REASON }, tx)).toMatchObject({ status: "IN_REVIEW" });
    }));
});

describe("asking for a reviewer", () => {
  it("is an owner's request, once per project, that assigns nothing and puts the project first in the operators' list", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const owner = actor(w.u.ownerAdmin);
      const make = async (title: string) => {
        const p = await createProject(owner, { ownerOrgId: w.org.owner.id, title: `${title} ${w.tag}`, activityType: "WETLAND", boundary: SQUARE }, tx);
        await updateProject(owner, p.id, { status: "ACTIVE" }, tx);
        return p;
      };
      const asked = await make("Zebra wetland"); // last by title, first once it asks
      await make("Aardvark wetland");

      expect(await reviewerRequestedAt(owner, asked.id, tx)).toBeNull();
      await expect(requestReviewer(actor(w.u.ownerMember), asked.id, tx)).rejects.toBeInstanceOf(ForbiddenError);
      for (const who of [w.u.v1, w.u.vAdmin, w.u.funder, w.u.outsider, w.u.platformAdmin]) {
        await expect(requestReviewer(actor(who), asked.id, tx)).rejects.toBeInstanceOf(NotFoundError);
      }
      // the fixture's project already has one
      await expect(requestReviewer(owner, w.project.id, tx)).rejects.toBeInstanceOf(ConflictError);

      const { requestedAt } = await requestReviewer(owner, asked.id, tx);
      expect(await reviewerRequestedAt(owner, asked.id, tx)).toEqual(requestedAt);
      await expect(requestReviewer(owner, asked.id, tx)).rejects.toBeInstanceOf(ConflictError);
      await expect(reviewerRequestedAt(actor(w.u.v1), asked.id, tx)).rejects.toBeInstanceOf(NotFoundError);
      expect(await tx.select().from(projectAssignment).where(eq(projectAssignment.projectId, asked.id))).toEqual([]);

      const events = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(events.at(-1)).toMatchObject({ eventType: "REVIEWER_REQUESTED", actorUserId: w.u.ownerAdmin.id, payload: { projectId: asked.id } });

      const list = await asOperators([w.u.platformAdmin], () => unassignedProjects(actor(w.u.platformAdmin), tx));
      const mine = list.filter((p) => p.title.endsWith(w.tag));
      expect(mine.map((p) => p.id)[0]).toBe(asked.id);
      expect(mine[0]!.requestedAt).toEqual(requestedAt);
      expect(mine[1]!.requestedAt).toBeNull();
    }));
});

describe("the job queue on /admin", () => {
  it("lists the jobs that have stopped and puts them back in the queue, for an operator only", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const kind = `test.admin.${w.tag}`;
      const longAgo = new Date(Date.now() - 60 * 60 * 1000);
      const rows = await tx
        .insert(job)
        .values([
          { kind, payload: {}, status: "FAILED", attempts: 5, lastError: "storage did not answer", idempotencyKey: `${kind}:failed` },
          { kind, payload: {}, status: "STUCK", attempts: 5, idempotencyKey: `${kind}:stuck` },
          // its worker died on the last allowed attempt: nothing will ever pick it up again
          { kind, payload: {}, status: "RUNNING", attempts: 5, lockedAt: longAgo, idempotencyKey: `${kind}:abandoned` },
          { kind, payload: {}, status: "DONE", attempts: 1, idempotencyKey: `${kind}:done` },
          { kind, payload: {}, status: "PENDING", attempts: 2, idempotencyKey: `${kind}:waiting` },
        ])
        .returning();
      const [failed, stuck, abandoned, done, waiting] = rows.map((r) => r.id);

      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.vAdmin, w.u.funder, w.u.platformAdmin]) {
        await expect(jobQueueHealth(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(retryHaltedJobs(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
      }

      await asOperators([w.u.platformAdmin], async () => {
        const op = actor(w.u.platformAdmin);
        const health = await jobQueueHealth(op, tx);
        const mine = health.halted.filter((j) => j.kind === kind);
        expect(mine.map((j) => [j.id, j.status]).sort()).toEqual([[failed, "FAILED"], [stuck, "STUCK"], [abandoned, "STUCK"]].sort());
        expect(mine.find((j) => j.id === failed)).toMatchObject({ attempts: 5, lastError: "storage did not answer" });
        expect(health.counts.FAILED).toBeGreaterThanOrEqual(1);
        expect(health.counts.STUCK).toBeGreaterThanOrEqual(2);

        expect(await retryHaltedJobs(op, tx)).toBeGreaterThanOrEqual(3);
        const after = new Map((await tx.select().from(job).where(eq(job.kind, kind))).map((j) => [j.id, j]));
        for (const id of [failed, stuck, abandoned]) expect(after.get(id!)).toMatchObject({ status: "PENDING", attempts: 0, lastError: null, lockedAt: null });
        // what had not stopped is left alone
        expect(after.get(done!)).toMatchObject({ status: "DONE", attempts: 1 });
        expect(after.get(waiting!)).toMatchObject({ status: "PENDING", attempts: 2 });
        expect((await jobQueueHealth(op, tx)).halted.filter((j) => j.kind === kind)).toEqual([]);
      });
    }));
});

describe("matchRef resolution", () => {
  it("shows an operator both sides, and records a conclusion that names neither to the flagged side", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      // the earlier photo, in the owner's submission
      const [original] = await tx
        .insert(evidenceFile)
        .values({ submissionId: w.submission.id, role: "BEFORE", storageKey: `admin/${w.tag}/original`, mime: "image/jpeg", sizeBytes: 10, sha256: "a".repeat(64) })
        .returning();
      // the same bytes, later, from another organisation's project
      const [otherProject] = await tx.insert(impactProject).values({ ownerOrgId: w.org.other.id, title: `Other ${w.tag}`, activityType: "MANGROVE", status: "ACTIVE" }).returning();
      const copySubmission = await addSubmission(tx, { projectId: otherProject!.id, ownerOrgId: w.org.other.id, userId: w.u.outsider.id });
      const [copy] = await tx
        .insert(evidenceFile)
        .values({ submissionId: copySubmission.id, role: "AFTER", storageKey: `admin/${w.tag}/copy`, mime: "image/jpeg", sizeBytes: 10, sha256: "a".repeat(64) })
        .returning();
      const ref = matchRef(original!.id);
      await tx.insert(forensicFinding).values({
        submissionId: copySubmission.id,
        evidenceFileId: copy!.id,
        kind: "EXACT_DUPLICATE_OTHER_ORG",
        severity: "HIGH",
        reason: "This exact file was already submitted by a different organisation.",
        evidence: { sha256: "a".repeat(64), matchRef: ref },
        ruleVersion: "forensics.v1",
      });

      for (const who of [w.u.ownerAdmin, w.u.vAdmin, w.u.outsider, w.u.platformAdmin]) {
        await expect(lookupMatchRef(actor(who), ref, tx)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(resolveMatchRef(actor(who), ref, { outcome: "CLEARED", reason: REASON }, tx)).rejects.toBeInstanceOf(ForbiddenError);
      }

      await asOperators([w.u.platformAdmin], async () => {
        const op = actor(w.u.platformAdmin);
        await expect(lookupMatchRef(op, "mr_nothex", tx)).rejects.toBeInstanceOf(ValidationError);
        await expect(lookupMatchRef(op, `mr_${"0".repeat(32)}`, tx)).rejects.toBeInstanceOf(NotFoundError);

        const found = await lookupMatchRef(op, ` ${ref} `, tx);
        expect(found.flagged).toMatchObject([{ submissionId: copySubmission.id, ownerOrgName: w.org.other.name, kind: "EXACT_DUPLICATE_OTHER_ORG", distance: null }]);
        expect(found.matched).toMatchObject({ fileId: original!.id, submissionId: w.submission.id, ownerOrgName: w.org.owner.name, projectTitle: w.project.title });
        expect(found.resolutions).toEqual([]);

        await expect(resolveMatchRef(op, ref, { outcome: "CLEARED", reason: "too short" }, tx)).rejects.toBeInstanceOf(ValidationError);
        expect(await resolveMatchRef(op, ref, { outcome: "CLEARED", reason: "Same nursery photo, reused with the other trust's consent." }, tx)).toBe(1);
        expect((await lookupMatchRef(op, ref, tx)).resolutions).toMatchObject([{ outcome: "CLEARED", by: "platformAdmin" }]);
      });

      // written on the flagged side's chain, naming nothing of the other side
      const events = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.other.id)).orderBy(asc(auditEvent.seq));
      const resolved = events.at(-1)!;
      expect(resolved).toMatchObject({ eventType: "MATCH_RESOLVED", actorUserId: w.u.platformAdmin.id, payload: { matchRef: ref, submissionId: copySubmission.id, outcome: "CLEARED" } });
      for (const secret of [w.submission.id, w.org.owner.id, w.org.owner.name, w.project.id, original!.id]) expect(JSON.stringify(resolved.payload)).not.toContain(secret);
      expect(verifyChainRows(events)).toMatchObject({ ok: true });

      // the flagged submission's readers see the conclusion beside the finding
      const { findings } = await listFindings(actor(w.u.outsider), copySubmission.id, tx);
      expect(findings[0]!.resolution).toMatchObject({ outcome: "CLEARED", reason: "Same nursery photo, reused with the other trust's consent." });
    }));
});
