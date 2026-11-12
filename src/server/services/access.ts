import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { OrgType } from "../../lib/org-type";
import type { z } from "zod";
import { member, organization, projectAssignment } from "../db/schema";
import type * as schema from "../db/schema";
import { ValidationError } from "./errors";

/** The pooled client or a transaction. Tests pass a transaction they roll back. */
export type Executor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/** Who is asking. Always re-checked against the database; never a session claim. */
export type Actor = { userId: string };

export type Membership = { orgId: string; orgName: string; orgType: OrgType; role: string };

/** Current memberships of a user, read fresh (docs/04-AUTH.md §3). */
export async function membershipsOf(x: Executor, userId: string): Promise<Membership[]> {
  const rows = await x
    .select({ orgId: member.organizationId, orgName: organization.name, orgType: organization.orgType, role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId));
  return rows;
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Everything a read needs to know about the caller, from one membership query. */
export async function actorContext(x: Executor, actor: Actor | null) {
  const memberships = actor ? await membershipsOf(x, actor.userId) : [];
  const orgIds = memberships.map((m) => m.orgId);
  const idsOfType = (t: OrgType) => memberships.filter((m) => m.orgType === t).map((m) => m.orgId);
  return { memberships, orgIds, verifierOrgIds: idsOfType("VERIFIER"), funderOrgIds: idsOfType("FUNDER") };
}
export type ActorContext = Awaited<ReturnType<typeof actorContext>>;

/** Which of `verifierOrgIds` are assigned to the project. */
export async function assignedVerifierOrgs(x: Executor, projectId: string, verifierOrgIds: string[]): Promise<string[]> {
  if (!verifierOrgIds.length) return [];
  const rows = await x
    .select({ orgId: projectAssignment.verifierOrgId })
    .from(projectAssignment)
    .where(and(eq(projectAssignment.projectId, projectId), inArray(projectAssignment.verifierOrgId, verifierOrgIds)));
  return rows.map((r) => r.orgId);
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  }
  return result.data;
}
