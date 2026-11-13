import "server-only";
import { and, asc, desc, eq, inArray, ne, notExists, sql } from "drizzle-orm";
import { env } from "../../env";
import { canRunAnchoring } from "../../lib/org-type";
import { db } from "../db/client";
import { auditEvent, impactProject, job, organization, projectAssignment } from "../db/schema";
import { actorContext, isUuid, type Actor, type Executor } from "./access";
import { appendAuditEvent, verifyAuditChains, verifyChainRows, type ChainVerdict } from "./audit-chain.service";
import { ConflictError, ConflictOfInterestError, ForbiddenError, NotFoundError } from "./errors";
import { markStuckJobs, retryJob } from "./jobs.service";

// The panels of /admin beyond anchoring (docs/05-ROUTES.md §3): audit chains, the tamper demo,
// taking a project on for review, and the job queue. Same gate as anchoring: an admin of a
// verifier organisation. Chain verification reads the chains, and the tamper demo alters a copy
// in memory, because the table itself refuses every UPDATE.

async function assertAdmin(x: Executor, actor: Actor): Promise<void> {
  const { memberships } = await actorContext(x, actor);
  if (!canRunAnchoring(memberships)) throw new ForbiddenError("only an admin of a verifier organisation may open this");
}

export type ChainHealth = { orgId: string; orgName: string; events: number } & ChainVerdict;

/** Every organisation's audit chain, walked from genesis: whether it verifies, and where it first fails. */
export async function auditChainHealth(actor: Actor, x: Executor = db): Promise<ChainHealth[]> {
  await assertAdmin(x, actor);
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
  await assertAdmin(x, actor);
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

export type UnassignedProject = { id: string; title: string; ownerOrgName: string; activityType: (typeof impactProject.$inferSelect)["activityType"] };

/** Active projects no verifier organisation reviews yet: nothing submitted to them can be approved until one does. */
export async function unassignedProjects(actor: Actor, x: Executor = db): Promise<UnassignedProject[]> {
  await assertAdmin(x, actor);
  return x
    .select({ id: impactProject.id, title: impactProject.title, ownerOrgName: organization.name, activityType: impactProject.activityType })
    .from(impactProject)
    .innerJoin(organization, eq(organization.id, impactProject.ownerOrgId))
    .where(
      and(
        eq(impactProject.status, "ACTIVE"),
        notExists(x.select({ one: sql`1` }).from(projectAssignment).where(eq(projectAssignment.projectId, impactProject.id))),
      ),
    )
    .orderBy(asc(impactProject.title));
}

/**
 * An admin of a verifier organisation takes a project on for review: the assignment that lets
 * that organisation's members vote on it (docs/04-AUTH.md §2). Refused when the admin also
 * belongs to the organisation that owns the project: nobody arranges to review their own
 * organisation's work. Written to the owner's audit chain.
 */
export async function takeOnReview(actor: Actor, projectId: string, x: Executor = db): Promise<{ verifierOrgId: string }> {
  return x.transaction(async (tx) => {
    const ctx = await actorContext(tx, actor);
    const mine = ctx.memberships.find((m) => m.orgType === "VERIFIER" && (m.role === "admin" || m.role === "owner"));
    if (!mine) throw new ForbiddenError("only an admin of a verifier organisation may take a project on for review");
    const [project] = isUuid(projectId) ? await tx.select().from(impactProject).where(and(eq(impactProject.id, projectId), eq(impactProject.status, "ACTIVE"))) : [];
    if (!project) throw new NotFoundError("project not found");
    if (ctx.orgIds.includes(project.ownerOrgId)) throw new ConflictOfInterestError("cannot review your own organisation's project");
    const [already] = await tx
      .select({ id: projectAssignment.id })
      .from(projectAssignment)
      .where(and(eq(projectAssignment.projectId, project.id), eq(projectAssignment.verifierOrgId, mine.orgId)));
    if (already) throw new ConflictError("your organisation already reviews this project");

    await tx.insert(projectAssignment).values({ projectId: project.id, verifierOrgId: mine.orgId, assignedByUserId: actor.userId });
    await appendAuditEvent(tx, {
      orgId: project.ownerOrgId,
      eventType: "VERIFIER_ASSIGNED",
      actorUserId: actor.userId,
      payload: { projectId: project.id, verifierOrgId: mine.orgId },
    });
    return { verifierOrgId: mine.orgId };
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
  await assertAdmin(x, actor);
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
  await assertAdmin(x, actor);
  await markStuckJobs(x);
  const rows = await x.select({ id: job.id }).from(job).where(inArray(job.status, ["FAILED", "STUCK"]));
  let retried = 0;
  for (const r of rows) if (await retryJob(r.id, x)) retried++;
  return retried;
}
