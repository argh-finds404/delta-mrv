import "server-only";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { assertTransition, InvalidTransitionError, type SubmissionStatus } from "../../lib/state-machine";
import { db } from "../db/client";
import type { GeoPoint } from "../db/schema/types";
import {
  decision as decisionEnum,
  evidenceFile,
  evidenceSubmission,
  forensicFinding,
  impactProject,
  organization,
  projectAssignment,
  reviewDecision,
} from "../db/schema";
import { actorContext, assignedVerifierOrgs, isUuid, parseInput, type Actor, type Executor } from "./access";
import { appendAuditEvent } from "./audit-chain.service";
import { ConflictError, ConflictOfInterestError, ForbiddenError } from "./errors";
import { sealManifest } from "./manifest.service";
import { getSubmission, toSummary, type SubmissionSummary } from "./submissions.service";

export type ReviewGate = {
  /** The assigned verifier organisation the vote is recorded under. */
  reviewerOrgId: string;
  role: string;
  submission: { id: string; projectId: string; ownerOrgId: string; status: SubmissionStatus; round: number };
};

const decisionSchema = z.object({
  decision: z.enum(decisionEnum.enumValues),
  // docs/01-FEATURE-LOCK.md: at least 20 characters, here and as a database CHECK.
  // Trimmed first, so twenty spaces are not a reason.
  reason: z.string().trim().min(20),
});
export type DecisionInput = z.input<typeof decisionSchema>;

/**
 * The conflict-of-interest gate (docs/04-AUTH.md §4). Rejections fire in this order and
 * the order is part of the contract: a conflict of interest is reported as one even when
 * the caller would also fail a later check.
 *
 *   1. submission not found or not visible        ForbiddenError
 *   2. a membership in the project's owner org    ConflictOfInterestError
 *   3. no VERIFIER-type membership                ForbiddenError
 *   4. none of those orgs is assigned             ForbiddenError
 *   5. already decided in this round              ConflictError
 *
 * then the submission must still be open, and on ESCALATED the voter must be an admin of
 * an assigned verifier org. A caller with several memberships is judged on all of them:
 * belonging to the owner org at all is a conflict.
 *
 * Call inside the transaction that writes the decision.
 */
export async function assertCanReview(userId: string, submissionId: string, x: Executor = db): Promise<ReviewGate> {
  // 1
  const submission = isUuid(submissionId)
    ? (await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, submissionId)))[0]
    : undefined;
  if (!submission) throw new ForbiddenError("submission not found or not visible");

  const ctx = await actorContext(x, { userId });

  // 2
  if (ctx.orgIds.includes(submission.ownerOrgId)) {
    throw new ConflictOfInterestError("cannot review your own organisation's submission");
  }
  // 3
  if (!ctx.verifierOrgIds.length) throw new ForbiddenError("organisation is not a verifier");
  // 4
  const assigned = await assignedVerifierOrgs(x, submission.projectId, ctx.verifierOrgIds);
  if (!assigned.length) throw new ForbiddenError("organisation is not assigned to this project");

  // 5
  const [prior] = await x
    .select({ id: reviewDecision.id })
    .from(reviewDecision)
    .where(
      and(
        eq(reviewDecision.submissionId, submission.id),
        eq(reviewDecision.round, submission.round),
        eq(reviewDecision.reviewerUserId, userId),
      ),
    )
    .limit(1);
  if (prior) throw new ConflictError("this user has already decided in this round");

  if (submission.status !== "IN_REVIEW" && submission.status !== "ESCALATED") {
    throw new ConflictError(`submission is ${submission.status}, not open for review`);
  }

  // Prefer an admin membership among the assigned orgs: it is the one that can break a tie.
  const roles = new Map(ctx.memberships.filter((m) => assigned.includes(m.orgId)).map((m) => [m.orgId, m.role]));
  const adminOrg = assigned.find((o) => roles.get(o) === "admin");
  const reviewerOrgId = adminOrg ?? assigned[0]!;
  const role = roles.get(reviewerOrgId)!;

  if (submission.status === "ESCALATED" && role !== "admin") {
    throw new ForbiddenError("only an admin of an assigned verifier organisation may cast the deciding vote");
  }

  return { reviewerOrgId, role, submission };
}

/**
 * Records one decision and moves the submission, in one transaction. 2 approvals -> APPROVED,
 * 2 rejections -> REJECTED, 1 + 1 -> ESCALATED, any request for more proof ->
 * NEEDS_MORE_PROOF; on ESCALATED one admin vote decides. Quorum counts the current round only.
 */
export async function castDecision(
  actor: Actor,
  submissionId: string,
  input: DecisionInput,
  x: Executor = db,
): Promise<{ decisionId: string; status: SubmissionStatus; round: number }> {
  const data = parseInput(decisionSchema, input);

  return x.transaction(async (tx) => {
    // Serialise concurrent votes on one submission so the tally below cannot race.
    if (isUuid(submissionId)) {
      await tx.select({ id: evidenceSubmission.id }).from(evidenceSubmission).where(eq(evidenceSubmission.id, submissionId)).for("update");
    }
    const gate = await assertCanReview(actor.userId, submissionId, tx);
    const { status: current, round } = gate.submission;

    // An escalated submission is decided by this vote; it cannot go back for more proof.
    let next: SubmissionStatus | null = null;
    if (data.decision === "REQUEST_MORE_PROOF") next = "NEEDS_MORE_PROOF";
    else if (current === "ESCALATED") next = data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    try {
      if (next) assertTransition(current, next);
    } catch (e) {
      if (e instanceof InvalidTransitionError) throw new ConflictError(e.message);
      throw e;
    }

    const [row] = await tx
      .insert(reviewDecision)
      .values({
        submissionId,
        round,
        reviewerUserId: actor.userId,
        reviewerOrgId: gate.reviewerOrgId,
        decision: data.decision,
        reason: data.reason,
      })
      .returning({ id: reviewDecision.id, createdAt: reviewDecision.createdAt });

    if (!next) {
      const votes = await tx
        .select({ decision: reviewDecision.decision })
        .from(reviewDecision)
        .where(and(eq(reviewDecision.submissionId, submissionId), eq(reviewDecision.round, round)));
      const approvals = votes.filter((v) => v.decision === "APPROVE").length;
      const rejections = votes.filter((v) => v.decision === "REJECT").length;
      if (approvals >= 2) next = "APPROVED";
      else if (rejections >= 2) next = "REJECTED";
      else if (approvals === 1 && rejections === 1) next = "ESCALATED";
    }

    let status = current;
    if (next) {
      assertTransition(current, next);
      await tx.update(evidenceSubmission).set({ status: next }).where(eq(evidenceSubmission.id, submissionId));
      status = next;
    }
    // on the claimant's chain: their record changed; the event names who reviewed it
    const { eventHash } = await appendAuditEvent(tx, {
      orgId: gate.submission.ownerOrgId,
      eventType: "REVIEW_DECISION",
      actorUserId: actor.userId,
      payload: { submissionId, decisionId: row!.id, round, decision: data.decision, reviewerOrgId: gate.reviewerOrgId, from: current, status },
    });
    // the approved record, fixed as one canonical document: what gets anchored (A2)
    if (status === "APPROVED") {
      await sealManifest(tx, submissionId, { verifierOrgId: gate.reviewerOrgId, approvedAt: row!.createdAt, orgAuditChainHead: eventHash });
    }
    return { decisionId: row!.id, status, round };
  });
}

/** Submissions awaiting a verdict on projects the caller's verifier orgs are assigned to. */
export type RoundDecision = {
  decision: (typeof reviewDecision.$inferSelect)["decision"];
  reason: string;
  round: number;
  createdAt: Date;
  reviewerOrgName: string;
  mine: boolean;
};
export type RoundView = {
  round: number;
  counts: { approve: number; reject: number; moreProof: number };
  hasVoted: boolean;
  /** The current round's decisions; null while the round is open and the caller has not voted. */
  decisions: RoundDecision[] | null;
  earlierRounds: RoundDecision[];
};

/**
 * A4 (docs/16-AMENDMENTS-v2.md): while a round is open, its decisions and reasons are hidden from
 * anyone who has not voted in it, so no reviewer is anchored by another's verdict; counts are
 * not hidden. Earlier rounds, and a resolved round, are history and visible to every caller who
 * may see the submission. Who may see it at all is getSubmission's rule: anyone else gets a 404.
 */
export async function getRoundDecisions(actor: Actor, submissionId: string, x: Executor = db): Promise<RoundView> {
  const s = await getSubmission(actor, submissionId, x);
  const rows = await x
    .select({
      decision: reviewDecision.decision,
      reason: reviewDecision.reason,
      round: reviewDecision.round,
      createdAt: reviewDecision.createdAt,
      reviewerUserId: reviewDecision.reviewerUserId,
      reviewerOrgName: organization.name,
    })
    .from(reviewDecision)
    .innerJoin(organization, eq(organization.id, reviewDecision.reviewerOrgId))
    .where(eq(reviewDecision.submissionId, s.id))
    .orderBy(asc(reviewDecision.createdAt), asc(reviewDecision.id));
  const view = ({ reviewerUserId, ...r }: (typeof rows)[number]): RoundDecision => ({ ...r, mine: reviewerUserId === actor.userId });
  const current = rows.filter((r) => r.round === s.round);
  const hasVoted = current.some((r) => r.reviewerUserId === actor.userId);
  const open = s.status === "IN_REVIEW" || s.status === "ESCALATED";
  const count = (d: RoundDecision["decision"]) => current.filter((r) => r.decision === d).length;
  return {
    round: s.round,
    counts: { approve: count("APPROVE"), reject: count("REJECT"), moreProof: count("REQUEST_MORE_PROOF") },
    hasVoted,
    decisions: open && !hasVoted ? null : current.map(view),
    earlierRounds: rows.filter((r) => r.round < s.round).map(view),
  };
}

export async function listReviewQueue(actor: Actor, x: Executor = db): Promise<SubmissionSummary[]> {
  const ctx = await actorContext(x, actor);
  if (!ctx.verifierOrgIds.length) return [];

  const assigned = x
    .select({ id: projectAssignment.projectId })
    .from(projectAssignment)
    .where(inArray(projectAssignment.verifierOrgId, ctx.verifierOrgIds));

  const rows = await x
    .select({ s: evidenceSubmission })
    .from(evidenceSubmission)
    .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
    .where(
      and(
        inArray(evidenceSubmission.projectId, assigned),
        inArray(evidenceSubmission.status, ["IN_REVIEW", "ESCALATED"]),
        // never work the caller's own organisation originated
        notInArray(evidenceSubmission.ownerOrgId, ctx.orgIds),
      ),
    )
    .orderBy(asc(evidenceSubmission.submittedAt));
  return rows.map(({ s }) => toSummary(s));
}

export type ReviewQueueItem = SubmissionSummary & {
  projectTitle: string;
  ownerOrgName: string;
  activityType: string;
  /** Votes in the current round only; never who cast them. */
  approvals: number;
  rejections: number;
  userDecision: "APPROVE" | "REJECT" | "REQUEST_MORE_PROOF" | null;
  findingCounts: { high: number; medium: number; low: number; info: number };
  /**
   * The evidence files, every round, oldest first: a record in a later round keeps the pair of
   * its first. Open one through GET /api/evidence/[id]. `capturedAt` and `gps` are what the file
   * itself states, null when it does not say.
   */
  files: { id: string; role: "BEFORE" | "AFTER" | "SUPPLEMENT"; round: number; sha256: string; capturedAt: Date | null; gps: GeoPoint | null }[];
};

export type ReviewQueueOverview = {
  /** Why the list may be empty: not a verifier at all, verifier with no assignments, or all caught up. */
  isVerifier: boolean;
  hasAssignments: boolean;
  total: number;
  items: ReviewQueueItem[];
};

/**
 * Everything the Lab's queue pane needs in one call. Scoped exactly like listReviewQueue, so a
 * caller outside an assigned verifier org gets an empty overview, never an error. The page is
 * the oldest `limit` submissions, plus `focusId` when it is in the caller's queue.
 */
export async function reviewQueueOverview(actor: Actor, limit = 100, x: Executor = db, focusId?: string): Promise<ReviewQueueOverview> {
  const ctx = await actorContext(x, actor);
  if (!ctx.verifierOrgIds.length) return { isVerifier: false, hasAssignments: false, total: 0, items: [] };

  const [assignment] = await x
    .select({ id: projectAssignment.id })
    .from(projectAssignment)
    .where(inArray(projectAssignment.verifierOrgId, ctx.verifierOrgIds))
    .limit(1);
  const queue = await listReviewQueue(actor, x);
  const page = queue.slice(0, limit);
  // a deep link (/lab?s=id) to a submission beyond the first page still opens it, if it is in the caller's queue at all
  const focus = focusId && !page.some((s) => s.id === focusId) ? queue.find((s) => s.id === focusId) : undefined;
  if (focus) page.unshift(focus);
  if (page.length === 0) return { isVerifier: true, hasAssignments: Boolean(assignment), total: 0, items: [] };

  const ids = page.map((s) => s.id);
  const [projects, orgs, votes, findings, files] = await Promise.all([
    x.select({ id: impactProject.id, title: impactProject.title, activityType: impactProject.activityType }).from(impactProject).where(inArray(impactProject.id, [...new Set(page.map((s) => s.projectId))])),
    x.select({ id: organization.id, name: organization.name }).from(organization).where(inArray(organization.id, [...new Set(page.map((s) => s.ownerOrgId))])),
    x.select({ submissionId: reviewDecision.submissionId, round: reviewDecision.round, decision: reviewDecision.decision, reviewer: reviewDecision.reviewerUserId }).from(reviewDecision).where(inArray(reviewDecision.submissionId, ids)),
    x.select({ submissionId: forensicFinding.submissionId, severity: forensicFinding.severity, n: sql<number>`count(*)::int` }).from(forensicFinding).where(inArray(forensicFinding.submissionId, ids)).groupBy(forensicFinding.submissionId, forensicFinding.severity),
    x.select({ submissionId: evidenceFile.submissionId, id: evidenceFile.id, role: evidenceFile.role, round: evidenceFile.round, sha256: evidenceFile.sha256, capturedAt: evidenceFile.capturedAt, gps: evidenceFile.gps }).from(evidenceFile).where(inArray(evidenceFile.submissionId, ids)).orderBy(asc(evidenceFile.round), asc(evidenceFile.role), asc(evidenceFile.createdAt)),
  ]);
  const project = new Map(projects.map((p) => [p.id, p]));
  const org = new Map(orgs.map((o) => [o.id, o.name]));

  const items = page.map((s): ReviewQueueItem => {
    const current = votes.filter((v) => v.submissionId === s.id && v.round === s.round);
    const counts = { high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) if (f.submissionId === s.id) counts[f.severity.toLowerCase() as keyof typeof counts] = f.n;
    return {
      ...s,
      projectTitle: project.get(s.projectId)?.title ?? "Unknown project",
      activityType: project.get(s.projectId)?.activityType ?? "",
      ownerOrgName: org.get(s.ownerOrgId) ?? "Unknown organisation",
      approvals: current.filter((v) => v.decision === "APPROVE").length,
      rejections: current.filter((v) => v.decision === "REJECT").length,
      userDecision: current.find((v) => v.reviewer === actor.userId)?.decision ?? null,
      findingCounts: counts,
      files: files.filter((f) => f.submissionId === s.id).map(({ id, role, round, sha256, capturedAt, gps }) => ({ id, role, round, sha256, capturedAt, gps })),
    };
  });
  return { isVerifier: true, hasAssignments: true, total: queue.length, items };
}
