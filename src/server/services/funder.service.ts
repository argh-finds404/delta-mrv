import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { evidenceSubmission, impactProject, organization, projectAssignment, projectFunder, projectPrivateLocation } from "../db/schema";
import { actorContext, type Actor, type Executor } from "./access";

// What a funder may see (docs/04-AUTH.md §5): the projects linked to it through project_funder,
// and of those only the APPROVED and ANCHORED records. Every number here is counted from those
// rows; nothing about a pending, rejected or escalated submission is read, counted or implied.

export type FunderPortfolio = {
  totals: {
    projects: number;
    /** Approved by two reviewers of an independent organisation; includes the anchored ones. */
    approved: number;
    anchored: number;
    /** Area, in hectares, of the funded sites that have at least one approved record. A site's size, not a claim about what grew there. */
    hectaresWithApprovedRecords: number;
    verifierOrgs: number;
  };
  projects: { id: string; title: string; activityType: (typeof impactProject.$inferSelect)["activityType"]; ownerOrgName: string; approved: number; anchored: number; hectares: number }[];
  /** The newest approved records, each with a public proof page. */
  latest: { submissionId: string; projectTitle: string; status: "APPROVED" | "ANCHORED"; submittedAt: Date }[];
};

/** The portfolio of the given funder organisations. Callers decide whose: a session's memberships, or an API key's organisation. */
export async function funderPortfolio(funderOrgIds: string[], x: Executor = db): Promise<FunderPortfolio> {
  const empty: FunderPortfolio = { totals: { projects: 0, approved: 0, anchored: 0, hectaresWithApprovedRecords: 0, verifierOrgs: 0 }, projects: [], latest: [] };
  if (!funderOrgIds.length) return empty;
  const linked = x.select({ id: projectFunder.projectId }).from(projectFunder).where(inArray(projectFunder.funderOrgId, funderOrgIds));
  const shown = sql`${evidenceSubmission.status} in ('APPROVED', 'ANCHORED')`;

  const projects = await x
    .select({
      id: impactProject.id,
      title: impactProject.title,
      activityType: impactProject.activityType,
      ownerOrgName: organization.name,
      approved: sql<number>`(count(${evidenceSubmission.id}) filter (where ${shown}))::int`,
      anchored: sql<number>`(count(${evidenceSubmission.id}) filter (where ${evidenceSubmission.status} = 'ANCHORED'))::int`,
      hectares: sql<number>`coalesce((select round((ST_Area(${projectPrivateLocation.boundary}) / 10000)::numeric, 1) from ${projectPrivateLocation} where ${projectPrivateLocation.projectId} = ${impactProject.id}), 0)::float8`,
    })
    .from(impactProject)
    .innerJoin(organization, eq(organization.id, impactProject.ownerOrgId))
    .leftJoin(evidenceSubmission, eq(evidenceSubmission.projectId, impactProject.id))
    .where(inArray(impactProject.id, linked))
    .groupBy(impactProject.id, organization.name)
    .orderBy(impactProject.title);
  if (!projects.length) return empty;

  const ids = projects.map((p) => p.id);
  const [[verifiers], latest] = await Promise.all([
    x.select({ n: sql<number>`count(distinct ${projectAssignment.verifierOrgId})::int` }).from(projectAssignment).where(inArray(projectAssignment.projectId, ids)),
    x
      .select({ submissionId: evidenceSubmission.id, projectTitle: impactProject.title, status: evidenceSubmission.status, submittedAt: evidenceSubmission.submittedAt })
      .from(evidenceSubmission)
      .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
      .where(and(inArray(evidenceSubmission.projectId, ids), shown))
      .orderBy(desc(evidenceSubmission.submittedAt))
      .limit(8),
  ]);

  const sum = (f: (p: (typeof projects)[number]) => number) => projects.reduce((n, p) => n + f(p), 0);
  return {
    totals: {
      projects: projects.length,
      approved: sum((p) => p.approved),
      anchored: sum((p) => p.anchored),
      hectaresWithApprovedRecords: Math.round(sum((p) => (p.approved > 0 ? p.hectares : 0)) * 10) / 10,
      verifierOrgs: verifiers!.n,
    },
    projects,
    latest: latest.map((l) => ({ ...l, status: l.status as "APPROVED" | "ANCHORED" })),
  };
}

/** The signed-in caller's funder portfolio, or null when they belong to no funder organisation. */
export async function myFunderPortfolio(actor: Actor, x: Executor = db): Promise<(FunderPortfolio & { orgId: string; orgName: string }) | null> {
  const ctx = await actorContext(x, actor);
  const org = ctx.memberships.find((m) => m.orgType === "FUNDER");
  if (!org) return null;
  return { ...(await funderPortfolio(ctx.funderOrgIds, x)), orgId: org.orgId, orgName: org.orgName };
}
