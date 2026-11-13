// The /admin services beyond anchoring: audit-chain health, the tamper demo, and a verifier
// organisation taking a project on for review.
//   - only an admin of a verifier organisation may open any of it
//   - the tamper demo edits a copy, never the stored chain, and names the exact event it changed
//   - a project is taken on by an independent organisation only: never by one whose admin
//     also belongs to the owner, and the assignment is on the owner's audit chain
//   - the job queue (M6): what has stopped is listed, and one press puts it back in the queue
import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auditEvent, job, member, projectAssignment } from "../../src/server/db/schema";
import { auditChainHealth, jobQueueHealth, retryHaltedJobs, takeOnReview, tamperDemo, unassignedProjects } from "../../src/server/services/admin.service";
import { verifyChainRows } from "../../src/server/services/audit-chain.service";
import { ConflictError, ConflictOfInterestError, ForbiddenError, NotFoundError } from "../../src/server/services/errors";
import { createProject, updateProject } from "../../src/server/services/projects.service";
import { castDecision } from "../../src/server/services/reviews.service";
import { client, inRollback } from "./db";
import { actor, addSubmission, REASON, SQUARE, world } from "./fixtures";

afterAll(() => client.end());

describe("audit chains on /admin", () => {
  it("are verified for a verifier-organisation admin and nobody else; the tamper demo finds the edited event and stores nothing", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      // three events on the owner's chain: the project opening, and two decisions
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);
      await castDecision(actor(w.u.v2), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);

      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.funder, w.u.platformAdmin]) {
        await expect(auditChainHealth(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
      }
      const health = await auditChainHealth(actor(w.u.vAdmin), tx);
      expect(health.find((h) => h.orgId === w.org.owner.id)).toMatchObject({ orgName: w.org.owner.name, events: 3, ok: true, firstBadSeq: null });

      const before = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      const previous = process.env.DEMO_MODE;
      try {
        const demo = await tamperDemo(actor(w.u.vAdmin), tx).catch((e: unknown) => e);
        // DEMO_MODE is read once at boot: the demo exists only where the server was started with it
        if (previous === "true") {
          expect(demo).toMatchObject({ before: { ok: true }, after: { ok: false } });
          const d = demo as Awaited<ReturnType<typeof tamperDemo>>;
          expect(d.after.firstBadSeq).toBe(d.tamperedSeq);
        } else {
          expect(demo).toBeInstanceOf(NotFoundError);
        }
      } finally {
        process.env.DEMO_MODE = previous;
      }
      // whatever the demo did, the stored chain is byte for byte what it was, and still verifies
      const after = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(after).toEqual(before);
      expect(verifyChainRows(after)).toMatchObject({ ok: true });
    }));
});

describe("taking a project on for review", () => {
  it("is for an admin of an independent verifier organisation, and is written to the owner's audit chain", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const fresh = await createProject({ userId: w.u.ownerAdmin.id }, { ownerOrgId: w.org.owner.id, title: `Unreviewed ${w.tag}`, activityType: "WETLAND", boundary: SQUARE }, tx);
      await updateProject({ userId: w.u.ownerAdmin.id }, fresh.id, { status: "ACTIVE" }, tx);

      expect((await unassignedProjects(actor(w.u.vAdmin), tx)).map((p) => p.id)).toContain(fresh.id);
      // the fixture's first project already has a reviewer, so it is not offered
      expect((await unassignedProjects(actor(w.u.vAdmin), tx)).map((p) => p.id)).not.toContain(w.project.id);

      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.funder, w.u.platformAdmin]) {
        await expect(takeOnReview(actor(who), fresh.id, tx)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(unassignedProjects(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
      }
      await expect(takeOnReview(actor(w.u.vAdmin), "00000000-0000-4000-8000-000000000000", tx)).rejects.toBeInstanceOf(NotFoundError);

      // a verifier admin who also belongs to the owner cannot arrange to review the owner's work
      await tx.insert(member).values({ organizationId: w.org.owner.id, userId: w.u.rivalAdmin.id, role: "member", createdAt: new Date() });
      await expect(takeOnReview(actor(w.u.rivalAdmin), fresh.id, tx)).rejects.toBeInstanceOf(ConflictOfInterestError);
      expect(await tx.select().from(projectAssignment).where(eq(projectAssignment.projectId, fresh.id))).toEqual([]);

      expect(await takeOnReview(actor(w.u.vAdmin), fresh.id, tx)).toEqual({ verifierOrgId: w.org.verifier.id });
      await expect(takeOnReview(actor(w.u.vAdmin), fresh.id, tx)).rejects.toBeInstanceOf(ConflictError);
      expect((await unassignedProjects(actor(w.u.vAdmin), tx)).map((p) => p.id)).not.toContain(fresh.id);
      const events = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(events.at(-1)).toMatchObject({ eventType: "VERIFIER_ASSIGNED", actorUserId: w.u.vAdmin.id, payload: { projectId: fresh.id, verifierOrgId: w.org.verifier.id } });
      expect(verifyChainRows(events)).toMatchObject({ ok: true });

      // and it does what it is for: that organisation's reviewers can now decide on the project
      const s = await addSubmission(tx, { projectId: fresh.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id });
      expect(await castDecision(actor(w.u.v1), s.id, { decision: "APPROVE", reason: REASON }, tx)).toMatchObject({ status: "IN_REVIEW" });
    }));
});

describe("the job queue on /admin", () => {
  it("lists the jobs that have stopped and puts them back in the queue, for a verifier-organisation admin only", () =>
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

      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.funder, w.u.platformAdmin]) {
        await expect(jobQueueHealth(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(retryHaltedJobs(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
      }

      const health = await jobQueueHealth(actor(w.u.vAdmin), tx);
      const mine = health.halted.filter((j) => j.kind === kind);
      expect(mine.map((j) => [j.id, j.status]).sort()).toEqual([[failed, "FAILED"], [stuck, "STUCK"], [abandoned, "STUCK"]].sort());
      expect(mine.find((j) => j.id === failed)).toMatchObject({ attempts: 5, lastError: "storage did not answer" });
      expect(health.counts.FAILED).toBeGreaterThanOrEqual(1);
      expect(health.counts.STUCK).toBeGreaterThanOrEqual(2);

      expect(await retryHaltedJobs(actor(w.u.vAdmin), tx)).toBeGreaterThanOrEqual(3);
      const after = new Map((await tx.select().from(job).where(eq(job.kind, kind))).map((j) => [j.id, j]));
      for (const id of [failed, stuck, abandoned]) expect(after.get(id!)).toMatchObject({ status: "PENDING", attempts: 0, lastError: null, lockedAt: null });
      // what had not stopped is left alone
      expect(after.get(done!)).toMatchObject({ status: "DONE", attempts: 1 });
      expect(after.get(waiting!)).toMatchObject({ status: "PENDING", attempts: 2 });
      expect((await jobQueueHealth(actor(w.u.vAdmin), tx)).halted.filter((j) => j.kind === kind)).toEqual([]);
    }));
});
