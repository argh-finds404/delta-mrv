import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { evidenceSubmission, impactProject, projectFunder } from "../db/schema";
import { actorContext, assignedVerifierOrgs, isUuid, type Actor, type ActorContext, type Executor } from "./access";
import { NotFoundError } from "./errors";

// Reads only. Intake (createDraft, finalize) is Stage 4.

export type SubmissionSummary = {
  id: string;
  projectId: string;
  ownerOrgId: string;
  status: (typeof evidenceSubmission.$inferSelect)["status"];
  round: number;
  riskScore: string | null;
  riskBand: (typeof evidenceSubmission.$inferSelect)["riskBand"];
  submittedAt: Date;
};

type SubmissionRow = typeof evidenceSubmission.$inferSelect;
type Status = SubmissionRow["status"];

const NOT_FOUND = "submission not found";

export const toSummary = (r: SubmissionRow): SubmissionSummary => ({
  id: r.id,
  projectId: r.projectId,
  ownerOrgId: r.ownerOrgId,
  status: r.status,
  round: r.round,
  riskScore: r.riskScore,
  riskBand: r.riskBand,
  submittedAt: r.submittedAt,
});

/**
 * Which statuses of one project's submissions the caller may see (docs/04-AUTH.md §5):
 * the owner org everything; an assigned verifier org everything past DRAFT; a funder org
 * linked through project_funder only APPROVED and ANCHORED. Null: nothing at all.
 */
async function visibleStatuses(
  x: Executor,
  ctx: ActorContext,
  project: { id: string; ownerOrgId: string },
): Promise<((s: Status) => boolean) | null> {
  if (ctx.orgIds.includes(project.ownerOrgId)) return () => true;

  const rules: ((s: Status) => boolean)[] = [];
  if ((await assignedVerifierOrgs(x, project.id, ctx.verifierOrgIds)).length) rules.push((s) => s !== "DRAFT");
  if (ctx.funderOrgIds.length) {
    const [link] = await x
      .select({ id: projectFunder.id })
      .from(projectFunder)
      .where(and(eq(projectFunder.projectId, project.id), inArray(projectFunder.funderOrgId, ctx.funderOrgIds)))
      .limit(1);
    if (link) rules.push((s) => s === "APPROVED" || s === "ANCHORED");
  }
  return rules.length ? (s) => rules.some((r) => r(s)) : null;
}

export async function getSubmission(actor: Actor | null, id: string, x: Executor = db): Promise<SubmissionSummary> {
  if (!isUuid(id)) throw new NotFoundError(NOT_FOUND);
  const [row] = await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id));
  if (!row) throw new NotFoundError(NOT_FOUND);
  const visible = await visibleStatuses(x, await actorContext(x, actor), { id: row.projectId, ownerOrgId: row.ownerOrgId });
  if (!visible || !visible(row.status)) throw new NotFoundError(NOT_FOUND);
  return toSummary(row);
}

export async function listSubmissionsForProject(actor: Actor | null, projectId: string, x: Executor = db): Promise<SubmissionSummary[]> {
  if (!isUuid(projectId)) return [];
  const [project] = await x.select({ id: impactProject.id, ownerOrgId: impactProject.ownerOrgId }).from(impactProject).where(eq(impactProject.id, projectId));
  if (!project) return [];
  const visible = await visibleStatuses(x, await actorContext(x, actor), project);
  if (!visible) return [];
  const rows = await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.projectId, projectId)).orderBy(desc(evidenceSubmission.submittedAt));
  return rows.filter((r) => visible(r.status)).map(toSummary);
}
