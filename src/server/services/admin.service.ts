import "server-only";
import { and, asc, desc, eq, inArray, ne, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "../../env";
import { db } from "../db/client";
import { auditEvent, evidenceFile, evidenceSubmission, forensicFinding, impactProject, job, organization, projectAssignment, user } from "../db/schema";
import { actorContext, isUuid, parseInput, type Actor, type Executor } from "./access";
import { appendAuditEvent, verifyAuditChains, verifyChainRows, type ChainVerdict } from "./audit-chain.service";
import { ConflictError, ConflictOfInterestError, NotFoundError, ValidationError } from "./errors";
import { matchRef, PERCEPTUAL_THRESHOLD } from "./forensics.service";
import { markStuckJobs, retryJob } from "./jobs.service";
import { assertOperator } from "./operators";

// The panels of /admin beyond anchoring (docs/05-ROUTES.md §3): audit chains, the tamper demo,
// assigning reviewers, the job queue and matchRef resolution. Operators only (operators.ts), the
// same gate as anchoring. Chain verification reads the chains, and the tamper demo alters a copy
// in memory, because the table itself refuses every UPDATE.

export type ChainHealth = { orgId: string; orgName: string; events: number } & ChainVerdict;

/** Every organisation's audit chain, walked from genesis: whether it verifies, and where it first fails. */
export async function auditChainHealth(actor: Actor, x: Executor = db): Promise<ChainHealth[]> {
  await assertOperator(x, actor);
  const reports = await verifyAuditChains(x);
  if (!reports.length) return [];
  const names = await x
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(inArray(organization.id, reports.map((r) => r.orgId)));
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  return reports.map((r) => ({ ...r, orgName: nameOf.get(r.orgId) ?? "Unknown organisation" })).sort((a, b) => a.orgName.localeCompare(b.orgName));
}

export type TamperDemo = { orgName: string; events: number; tamperedSeq: number; eventType: string; before: ChainVerdict; after: ChainVerdict };

/**
 * S5, DEMO_MODE only: takes the longest real chain, changes one event's payload in a copy, and
 * verifies both. The stored chain is untouched (the database refuses the edit); the point is
 * that verification names the exact event that was changed.
 */
export async function tamperDemo(actor: Actor, x: Executor = db): Promise<TamperDemo> {
  if (!env.DEMO_MODE) throw new NotFoundError("the tamper demo exists only in demo mode");
  await assertOperator(x, actor);
  const [longest] = await x
    .select({ orgId: auditEvent.orgId, n: sql<number>`count(*)::int` })
    .from(auditEvent)
    .groupBy(auditEvent.orgId)
    .orderBy(sql`count(*) desc`)
    .limit(1);
  if (!longest) throw new NotFoundError("no audit events exist yet: approve or submit something first");
  const rows = await x.select().from(auditEvent).where(eq(auditEvent.orgId, longest.orgId)).orderBy(asc(auditEvent.seq));
  const [org] = await x.select({ name: organization.name }).from(organization).where(eq(organization.id, longest.orgId));
  const target = rows[Math.floor(rows.length / 2)]!;
  const edited = rows.map((r) => (r.seq === target.seq ? { ...r, payload: { ...(r.payload as Record<string, unknown>), editedAfterTheFact: true } } : r));
  return {
    orgName: org?.name ?? "Unknown organisation",
    events: rows.length,
    tamperedSeq: target.seq,
    eventType: target.eventType,
    before: verifyChainRows(rows),
    after: verifyChainRows(edited),
  };
}

export type UnassignedProject = {
  id: string;
  title: string;
  ownerOrgName: string;
  activityType: (typeof impactProject.$inferSelect)["activityType"];
  /** When the owner asked for a reviewer, if they did. These are listed first. */
  requestedAt: Date | null;
};

/** Active projects no verifier organisation reviews yet: nothing submitted to them can be approved until one does. */
export async function unassignedProjects(actor: Actor, x: Executor = db): Promise<UnassignedProject[]> {
  await assertOperator(x, actor);
  const requestedAt = sql<string | null>`(
    select min(e.created_at) from ${auditEvent} e
    where e.org_id = ${impactProject.ownerOrgId} and e.event_type = 'REVIEWER_REQUESTED' and e.payload->>'projectId' = ${impactProject.id}::text)`;
  const rows = await x
    .select({ id: impactProject.id, title: impactProject.title, ownerOrgName: organization.name, activityType: impactProject.activityType, requestedAt })
    .from(impactProject)
    .innerJoin(organization, eq(organization.id, impactProject.ownerOrgId))
    .where(
      and(
        eq(impactProject.status, "ACTIVE"),
        notExists(x.select({ one: sql`1` }).from(projectAssignment).where(eq(projectAssignment.projectId, impactProject.id))),
      ),
    )
    .orderBy(sql`${requestedAt} asc nulls last`, asc(impactProject.title));
  // a timestamp read through a raw subquery arrives as text
  return rows.map((r) => ({ ...r, requestedAt: r.requestedAt ? new Date(r.requestedAt) : null }));
}

/** The verifier organisations an operator can assign, by name. */
export async function verifierOrganisations(actor: Actor, x: Executor = db): Promise<{ id: string; name: string }[]> {
  await assertOperator(x, actor);
  return x.select({ id: organization.id, name: organization.name }).from(organization).where(eq(organization.orgType, "VERIFIER")).orderBy(asc(organization.name));
}

/**
 * An operator assigns a verifier organisation to a project: the assignment that lets that
 * organisation's members vote on it (docs/04-AUTH.md §2). Organisations never assign themselves,
 * and an operator who belongs to the owning organisation cannot choose its reviewer. Written to
 * the owner's audit chain.
 */
export async function assignReviewer(actor: Actor, projectId: string, verifierOrgId: string, x: Executor = db): Promise<void> {
  await x.transaction(async (tx) => {
    await assertOperator(tx, actor);
    const [project] = isUuid(projectId) ? await tx.select().from(impactProject).where(and(eq(impactProject.id, projectId), eq(impactProject.status, "ACTIVE"))) : [];
    if (!project) throw new NotFoundError("project not found");
    const [verifier] = isUuid(verifierOrgId) ? await tx.select().from(organization).where(and(eq(organization.id, verifierOrgId), eq(organization.orgType, "VERIFIER"))) : [];
    if (!verifier) throw new ValidationError("Choose a verifier organisation.");
    const ctx = await actorContext(tx, actor);
    if (ctx.orgIds.includes(project.ownerOrgId)) throw new ConflictOfInterestError("An operator who belongs to the owning organisation cannot choose its reviewer.");
    const [already] = await tx
      .select({ id: projectAssignment.id })
      .from(projectAssignment)
      .where(and(eq(projectAssignment.projectId, project.id), eq(projectAssignment.verifierOrgId, verifier.id)));
    if (already) throw new ConflictError("That organisation already reviews this project.");

    await tx.insert(projectAssignment).values({ projectId: project.id, verifierOrgId: verifier.id, assignedByUserId: actor.userId });
    await appendAuditEvent(tx, {
      orgId: project.ownerOrgId,
      eventType: "VERIFIER_ASSIGNED",
      actorUserId: actor.userId,
      payload: { projectId: project.id, verifierOrgId: verifier.id },
    });
  });
}

export type QueueHealth = {
  /** Jobs by state. Finished jobs are history and are not counted. */
  counts: Record<"PENDING" | "RUNNING" | "FAILED" | "STUCK", number>;
  /** Jobs that will not run again unless someone retries them, newest first (at most 50). */
  halted: { id: string; kind: string; status: "FAILED" | "STUCK"; attempts: number; lastError: string | null; createdAt: Date }[];
};

/** The job queue as it stands (docs/01-FEATURE-LOCK.md M6). An abandoned job is marked STUCK first, as a drain would. */
export async function jobQueueHealth(actor: Actor, x: Executor = db): Promise<QueueHealth> {
  await assertOperator(x, actor);
  await markStuckJobs(x);
  const counts = { PENDING: 0, RUNNING: 0, FAILED: 0, STUCK: 0 };
  const rows = await x.select({ status: job.status, n: sql<number>`count(*)::int` }).from(job).where(ne(job.status, "DONE")).groupBy(job.status);
  for (const r of rows) if (r.status !== "DONE") counts[r.status] = r.n;
  const halted = await x
    .select({ id: job.id, kind: job.kind, status: job.status, attempts: job.attempts, lastError: job.lastError, createdAt: job.createdAt })
    .from(job)
    .where(inArray(job.status, ["FAILED", "STUCK"]))
    .orderBy(desc(job.createdAt))
    .limit(50);
  return { counts, halted: halted as QueueHealth["halted"] };
}

/** "Retry stuck jobs" (M6): every FAILED or STUCK job goes back in the queue with a fresh attempt budget. Returns how many. */
export async function retryHaltedJobs(actor: Actor, x: Executor = db): Promise<number> {
  await assertOperator(x, actor);
  await markStuckJobs(x);
  const rows = await x.select({ id: job.id }).from(job).where(inArray(job.status, ["FAILED", "STUCK"]));
  let retried = 0;
  for (const r of rows) if (await retryJob(r.id, x)) retried++;
  return retried;
}

// ---------------------------------------------------------------------------------------
// matchRef resolution (docs/10-FORENSICS.md §4). A cross-organisation finding names its match
// only by an opaque matchRef; an operator traces it here and records whether the match is a
// reuse, with a reason, on the flagged submission's audit chain. The record changes no finding,
// score or status: it is a note the reviewers read beside the finding.

const MATCH_REF = /^mr_[0-9a-f]{32}$/;

type Status = (typeof evidenceSubmission.$inferSelect)["status"];
export type MatchSide = { fileId: string; role: string; submissionId: string; status: Status; projectTitle: string; ownerOrgName: string };
export type MatchLookup = {
  matchRef: string;
  /** The files whose findings carry the reference: the later submissions. */
  flagged: (MatchSide & { findingId: string; kind: string; distance: number | null })[];
  /** The earlier file the reference names. Null if it no longer exists. */
  matched: MatchSide | null;
  resolutions: { outcome: "CONFIRMED" | "CLEARED"; reason: string; at: Date; by: string }[];
};

const fileContext = (x: Executor) =>
  x
    .select({
      fileId: evidenceFile.id,
      role: evidenceFile.role,
      submissionId: evidenceSubmission.id,
      status: evidenceSubmission.status,
      projectTitle: impactProject.title,
      ownerOrgName: organization.name,
      ownerOrgId: evidenceSubmission.ownerOrgId,
      sha256: evidenceFile.sha256,
      dhash: evidenceFile.dhash,
    })
    .from(evidenceFile)
    .innerJoin(evidenceSubmission, eq(evidenceSubmission.id, evidenceFile.submissionId))
    .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
    .innerJoin(organization, eq(organization.id, evidenceSubmission.ownerOrgId));
type FileContext = Awaited<ReturnType<ReturnType<typeof fileContext>["where"]>>[number];

const publicSide = (f: FileContext): MatchSide => ({ fileId: f.fileId, role: f.role, submissionId: f.submissionId, status: f.status, projectTitle: f.projectTitle, ownerOrgName: f.ownerOrgName });

async function flaggedBy(x: Executor, ref: string) {
  if (!MATCH_REF.test(ref)) throw new ValidationError("A match reference is mr_ followed by 32 hexadecimal characters.");
  const findings = await x
    .select({ findingId: forensicFinding.id, kind: forensicFinding.kind, evidence: forensicFinding.evidence, fileId: forensicFinding.evidenceFileId })
    .from(forensicFinding)
    .where(sql`${forensicFinding.evidence}->>'matchRef' = ${ref}`);
  if (!findings.length) throw new NotFoundError("No finding carries this match reference.");
  const ids = findings.map((f) => f.fileId).filter((id): id is string => id !== null);
  const files = ids.length ? await fileContext(x).where(inArray(evidenceFile.id, ids)) : [];
  return findings.flatMap((f) => {
    const file = files.find((r) => r.fileId === f.fileId);
    if (!file) return [];
    const distance = (f.evidence as { distance?: unknown }).distance;
    return [{ file, findingId: f.findingId, kind: f.kind, distance: typeof distance === "number" ? distance : null }];
  });
}

/** Traces a matchRef: the findings that carry it, and the earlier file it names. Operators only. */
export async function lookupMatchRef(actor: Actor, rawRef: string, x: Executor = db): Promise<MatchLookup> {
  await assertOperator(x, actor);
  const ref = rawRef.trim();
  const flagged = await flaggedBy(x, ref);
  // The reference is a keyed hash of the matched file's id, so it is found by recomputing it over
  // the only files that could have matched: the same bytes, or a near-identical picture.
  let matched: FileContext | undefined;
  for (const { file } of flagged) {
    const near = file.dhash ? sql` or (${evidenceFile.dhash} is not null and (${evidenceFile.dhash} <~> ${file.dhash}::bit(64)) < ${PERCEPTUAL_THRESHOLD})` : sql``;
    const candidates = await fileContext(x).where(and(ne(evidenceFile.id, file.fileId), sql`(${evidenceFile.sha256} = ${file.sha256}${near})`));
    matched = candidates.find((c) => matchRef(c.fileId) === ref);
    if (matched) break;
  }
  const events = await x
    .select({ payload: auditEvent.payload, at: auditEvent.createdAt, by: user.name })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(and(eq(auditEvent.eventType, "MATCH_RESOLVED"), sql`${auditEvent.payload}->>'matchRef' = ${ref}`))
    .orderBy(asc(auditEvent.createdAt));
  return {
    matchRef: ref,
    flagged: flagged.map((f) => ({ ...publicSide(f.file), findingId: f.findingId, kind: f.kind, distance: f.distance })),
    matched: matched ? publicSide(matched) : null,
    resolutions: events.map((e) => {
      const p = e.payload as { outcome: "CONFIRMED" | "CLEARED"; reason: string };
      return { outcome: p.outcome, reason: p.reason, at: e.at, by: e.by ?? "An operator" };
    }),
  };
}

const resolutionSchema = z.object({
  outcome: z.enum(["CONFIRMED", "CLEARED"]),
  reason: z.string().trim().min(20, "Write a reason of at least 20 characters."),
});
export type MatchResolutionInput = z.input<typeof resolutionSchema>;

/**
 * Records an operator's conclusion about a match: CONFIRMED (the same photograph supports two
 * claims) or CLEARED (not a reuse), with a reason, on the audit chain of every submission whose
 * finding carries the reference. The payload names nothing of the other side: the flagged
 * submission's reviewers read the reason. Returns how many submissions it was recorded on.
 */
export async function resolveMatchRef(actor: Actor, rawRef: string, input: MatchResolutionInput, x: Executor = db): Promise<number> {
  const data = parseInput(resolutionSchema, input);
  const ref = rawRef.trim();
  return x.transaction(async (tx) => {
    await assertOperator(tx, actor);
    const bySubmission = new Map<string, { ownerOrgId: string; findingIds: string[] }>();
    for (const f of await flaggedBy(tx, ref)) {
      const entry = bySubmission.get(f.file.submissionId) ?? { ownerOrgId: f.file.ownerOrgId, findingIds: [] };
      entry.findingIds.push(f.findingId);
      bySubmission.set(f.file.submissionId, entry);
    }
    for (const [submissionId, { ownerOrgId, findingIds }] of bySubmission) {
      await appendAuditEvent(tx, {
        orgId: ownerOrgId,
        eventType: "MATCH_RESOLVED",
        actorUserId: actor.userId,
        payload: { matchRef: ref, submissionId, findingIds: findingIds.sort(), outcome: data.outcome, reason: data.reason },
      });
    }
    return bySubmission.size;
  });
}
