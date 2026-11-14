import { randomUUID } from "node:crypto";
import {
  evidenceSubmission,
  member,
  organization,
  projectAssignment,
  user,
} from "../../src/server/db/schema";
import type { GeoPoint, GeoPolygon } from "../../src/server/db/schema/types";
import { createProject, updateProject } from "../../src/server/services/projects.service";
import type { Tx } from "./db";

// ~1 km square near Dhaka, counter-clockwise.
export const SQUARE: GeoPolygon = {
  type: "Polygon",
  coordinates: [[[90.4, 23.8], [90.41, 23.8], [90.41, 23.81], [90.4, 23.81], [90.4, 23.8]]],
};
export const INSIDE_SQUARE: GeoPoint = { type: "Point", coordinates: [90.405, 23.805] };
export const OUTSIDE_SQUARE: GeoPoint = { type: "Point", coordinates: [91.5, 24.5] };

export const REASON = "Reviewed the before and after pair against the boundary.";

const USERS = [
  "ownerAdmin", //   admin of the owner org
  "ownerMember", //  plain member of the owner org
  "v1", "v2", "v3", // members of the assigned verifier org
  "vAdmin", //       admin of the assigned verifier org
  "rivalMember", //  members of a verifier org that is NOT assigned
  "rivalAdmin",
  "funder", //       member of a funder org
  "platformAdmin", // belongs to no organisation at all
  "outsider", //     member of an unrelated OWNER org that has its own project
] as const;
type UserName = (typeof USERS)[number];

const ORGS = ["owner", "verifier", "rival", "funder", "other"] as const;
type OrgName = (typeof ORGS)[number];
const ORG_TYPE = { owner: "OWNER", verifier: "VERIFIER", rival: "VERIFIER", funder: "FUNDER", other: "OWNER" } as const;

const MEMBERSHIPS: [UserName, OrgName, "owner" | "admin" | "member"][] = [
  ["ownerAdmin", "owner", "admin"],
  ["ownerMember", "owner", "member"],
  ["v1", "verifier", "member"],
  ["v2", "verifier", "member"],
  ["v3", "verifier", "member"],
  ["vAdmin", "verifier", "admin"],
  ["rivalMember", "rival", "member"],
  ["rivalAdmin", "rival", "admin"],
  ["funder", "funder", "member"],
  ["outsider", "other", "member"],
];

/**
 * Five organisations, ten users, one ACTIVE project owned by `owner` and assigned to
 * `verifier`, and one IN_REVIEW submission on it. All inside the caller's transaction.
 */
export async function world(tx: Tx) {
  const tag = randomUUID().slice(0, 8);

  const userRows = await tx
    .insert(user)
    .values(USERS.map((n) => ({ name: n, email: `${n}-${tag}@example.test` })))
    .returning();
  const u = Object.fromEntries(USERS.map((n, i) => [n, userRows[i]!])) as Record<UserName, (typeof userRows)[number]>;

  const orgRows = await tx
    .insert(organization)
    .values(ORGS.map((n) => ({ name: `${n} ${tag}`, slug: `${n}-${tag}`, orgType: ORG_TYPE[n], createdAt: new Date() })))
    .returning();
  const org = Object.fromEntries(ORGS.map((n, i) => [n, orgRows[i]!])) as Record<OrgName, (typeof orgRows)[number]>;

  await tx.insert(member).values(
    MEMBERSHIPS.map(([un, on, role]) => ({ organizationId: org[on].id, userId: u[un].id, role, createdAt: new Date() })),
  );

  const draft = await createProject(
    { userId: u.ownerAdmin.id },
    { ownerOrgId: org.owner.id, title: `Mangrove ${tag}`, activityType: "MANGROVE", boundary: SQUARE },
    tx,
  );
  await updateProject({ userId: u.ownerAdmin.id }, draft.id, { status: "ACTIVE" }, tx);
  await tx.insert(projectAssignment).values({
    projectId: draft.id,
    verifierOrgId: org.verifier.id,
    assignedByUserId: u.platformAdmin.id,
  });
  const submission = await addSubmission(tx, { projectId: draft.id, ownerOrgId: org.owner.id, userId: u.ownerMember.id });

  return { tag, u, org, project: draft, submission };
}
export type World = Awaited<ReturnType<typeof world>>;

export async function addSubmission(
  tx: Tx,
  s: { projectId: string; ownerOrgId: string; userId: string; status?: (typeof evidenceSubmission.$inferInsert)["status"] },
) {
  const [row] = await tx
    .insert(evidenceSubmission)
    .values({ projectId: s.projectId, ownerOrgId: s.ownerOrgId, submittedByUserId: s.userId, status: s.status ?? "IN_REVIEW" })
    .returning();
  return row!;
}

export const actor = (u: { id: string }) => ({ userId: u.id });

/**
 * Runs fn with these users listed in OPERATOR_EMAILS, as a deployment lists its operators
 * (src/server/services/operators.ts reads the variable on every call).
 */
export async function asOperators<T>(users: { email: string }[], fn: () => Promise<T>): Promise<T> {
  const before = process.env.OPERATOR_EMAILS;
  process.env.OPERATOR_EMAILS = users.map((u) => u.email).join(", ");
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.OPERATOR_EMAILS;
    else process.env.OPERATOR_EMAILS = before;
  }
}
