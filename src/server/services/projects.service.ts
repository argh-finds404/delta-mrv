import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { locationCommitment } from "../../lib/crypto/location";
import { db } from "../db/client";
import {
  activityType,
  evidenceSubmission,
  impactProject,
  organization,
  projectAssignment,
  projectPrivateLocation,
} from "../db/schema";
import type { GeoPoint, GeoPolygon } from "../db/schema/types";
import {
  actorContext,
  assignedVerifierOrgs,
  isUuid,
  parseInput,
  type Actor,
  type ActorContext,
  type Executor,
} from "./access";
import { appendAuditEvent } from "./audit-chain.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { fuzzCentroid, polygonCentroid } from "../../lib/geo/fuzz";

export type ProjectAccess = "owner" | "verifier" | "public";

/** The caller's organisations, for the workspace's header and greeting. */
export async function myOrganisations(actor: Actor, x: Executor = db) {
  return (await actorContext(x, actor)).memberships;
}

/** What every caller may see. `fuzzedLocation` is a grid-cell centre, never the real site. */
export type ProjectSummary = {
  id: string;
  ownerOrgId: string;
  title: string;
  description: string | null;
  activityType: (typeof activityType.enumValues)[number];
  claimedQuantity: string | null;
  claimedUnit: string | null;
  toleranceMeters: number;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  fuzzedLocation: GeoPoint | null;
  locationCommitment: string | null;
  access: ProjectAccess;
  createdAt: Date;
};

/** `exact` is non-null only for the owner org and an assigned verifier org. */
export type ProjectDetail = ProjectSummary & {
  exact: { boundary: GeoPolygon; locationSalt: string } | null;
};

type ProjectRow = typeof impactProject.$inferSelect;

const NOT_FOUND = "project not found"; // one message for missing, malformed and hidden

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const boundarySchema = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(lonLat).min(4)).length(1, "exactly one ring: holes are not supported"),
  })
  .refine(({ coordinates: [ring] }) => {
    const [a, b] = [ring![0]!, ring![ring!.length - 1]!];
    return a[0] === b[0] && a[1] === b[1];
  }, "the ring must be closed: first and last position equal");

const metadata = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
  claimedQuantity: z.number().positive(),
  claimedUnit: z.string().trim().min(1).max(50),
  toleranceMeters: z.number().int().min(0).max(5000),
};
const createSchema = z.object({
  ownerOrgId: z.uuid(),
  title: metadata.title,
  description: metadata.description.optional(),
  activityType: z.enum(activityType.enumValues),
  claimedQuantity: metadata.claimedQuantity.optional(),
  claimedUnit: metadata.claimedUnit.optional(),
  toleranceMeters: metadata.toleranceMeters.optional(),
  boundary: boundarySchema,
});
// strict: the boundary, the salt and the owner never change after creation, because
// the commitment (and, later, anchored manifests) depend on them
const updateSchema = z
  .object({
    title: metadata.title,
    description: metadata.description,
    claimedQuantity: metadata.claimedQuantity,
    claimedUnit: metadata.claimedUnit,
    toleranceMeters: metadata.toleranceMeters,
    status: z.enum(["ACTIVE", "CLOSED"]),
  })
  .partial()
  .strict();

export type CreateProjectInput = z.input<typeof createSchema>;
export type UpdateProjectInput = z.input<typeof updateSchema>;

const NEXT_STATUS: Record<ProjectRow["status"], ProjectRow["status"][]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["CLOSED"],
  CLOSED: [],
};

// ---------------------------------------------------------------------------------------
// The one place exact geometry and the salt are read from.

async function readPrivateLocation(x: Executor, projectId: string) {
  const [loc] = await x
    .select()
    .from(projectPrivateLocation)
    .where(eq(projectPrivateLocation.projectId, projectId));
  if (!loc) throw new Error(`project ${projectId} has no private location row`);
  return { boundary: loc.boundary, locationSalt: loc.locationSalt.toString("hex") };
}

/**
 * Where a photo's GPS fix sits against a project's exact boundary (docs/10-FORENSICS.md §5):
 * covered, within the project's tolerance, and how far outside, in whole metres. Only the
 * answers leave this module, never the geometry.
 */
export async function locateAgainstBoundary(
  x: Executor,
  projectId: string,
  point: GeoPoint,
): Promise<{ inside: boolean; withinTolerance: boolean; distanceMeters: number; toleranceMeters: number }> {
  const [lon, lat] = point.coordinates;
  const pt = sql`ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography`;
  const [row] = await x.execute<{ inside: boolean; within: boolean; distance: number; tolerance: number }>(sql`
    select ST_Covers(l.boundary, ${pt}) as inside,
           ST_DWithin(l.boundary, ${pt}, p.tolerance_meters) as within,
           ST_Distance(l.boundary, ${pt}) as distance,
           p.tolerance_meters as tolerance
    from project_private_location l join impact_project p on p.id = l.project_id
    where l.project_id = ${projectId}`);
  if (!row) throw new Error(`project ${projectId} has no private location row`);
  return { inside: row.inside, withinTolerance: row.within, distanceMeters: Math.round(Number(row.distance)), toleranceMeters: row.tolerance };
}

function summarise(row: ProjectRow, access: ProjectAccess): ProjectSummary {
  return {
    id: row.id,
    ownerOrgId: row.ownerOrgId,
    title: row.title,
    description: row.description,
    activityType: row.activityType,
    claimedQuantity: row.claimedQuantity,
    claimedUnit: row.claimedUnit,
    toleranceMeters: row.toleranceMeters,
    status: row.status,
    fuzzedLocation: row.fuzzedCentroid,
    locationCommitment: row.locationCommitment,
    access,
    createdAt: row.createdAt,
  };
}

async function detail(x: Executor, row: ProjectRow, access: ProjectAccess): Promise<ProjectDetail> {
  const exact = access === "public" ? null : await readPrivateLocation(x, row.id);
  return { ...summarise(row, access), exact };
}

async function accessFor(x: Executor, ctx: ActorContext, row: ProjectRow): Promise<ProjectAccess | null> {
  if (ctx.orgIds.includes(row.ownerOrgId)) return "owner";
  if ((await assignedVerifierOrgs(x, row.id, ctx.verifierOrgIds)).length) return "verifier";
  return row.status === "ACTIVE" ? "public" : null;
}

async function loadVisible(x: Executor, actor: Actor | null, id: string) {
  if (!isUuid(id)) throw new NotFoundError(NOT_FOUND);
  const [row] = await x.select().from(impactProject).where(eq(impactProject.id, id));
  if (!row) throw new NotFoundError(NOT_FOUND);
  const access = await accessFor(x, await actorContext(x, actor), row);
  if (!access) throw new NotFoundError(NOT_FOUND);
  return { row, access };
}

/** Owner and admin of the owning org may change it. Everyone else: 404, or 403 for a plain member. */
async function loadForOwnerWrite(x: Executor, actor: Actor, id: string) {
  if (!isUuid(id)) throw new NotFoundError(NOT_FOUND);
  const [row] = await x.select().from(impactProject).where(eq(impactProject.id, id)).for("update");
  if (!row) throw new NotFoundError(NOT_FOUND);
  const ctx = await actorContext(x, actor);
  const mine = ctx.memberships.find((m) => m.orgId === row.ownerOrgId);
  if (!mine) throw new NotFoundError(NOT_FOUND);
  if (mine.role !== "owner" && mine.role !== "admin") throw new ForbiddenError("only an owner or admin of the organisation may change a project");
  return row;
}

// ---------------------------------------------------------------------------------------
// Public reads (docs/16-AMENDMENTS-v2.md A6). No actor parameter and no session branch: there
// is no code path from here to project_private_location, which is what makes the leak test
// (test/integration/fuzzing-leak.test.ts) meaningful.

/** An ACTIVE project as anyone may see it: the fuzzed cell centre and the commitment, never the site. */
export type PublicProject = {
  id: string;
  title: string;
  description: string | null;
  activityType: ProjectSummary["activityType"];
  claimedQuantity: string | null;
  claimedUnit: string | null;
  ownerOrgName: string;
  fuzzedLocation: GeoPoint | null;
  locationCommitment: string | null;
  createdAt: Date;
};

export type PublicProjectDetail = PublicProject & {
  /** The independent auditors. Naming them is part of the accountability (docs/14-PAGE-SPEC.md §3). */
  verifierOrgNames: string[];
  /** The record beside the claim: submission counts, never the submissions' contents. */
  record: { approved: number; anchored: number };
};

export type PublicProjectPage = { items: PublicProject[]; nextCursor: string | null };

export const PUBLIC_PAGE_MAX = 100;
const publicPageSchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(PUBLIC_PAGE_MAX).default(50),
});

// Column by column on purpose: a `select()` of the row would carry any column added later out to the public.
const publicColumns = {
  id: impactProject.id,
  title: impactProject.title,
  description: impactProject.description,
  activityType: impactProject.activityType,
  claimedQuantity: impactProject.claimedQuantity,
  claimedUnit: impactProject.claimedUnit,
  ownerOrgName: organization.name,
  fuzzedLocation: impactProject.fuzzedCentroid,
  locationCommitment: impactProject.locationCommitment,
  createdAt: impactProject.createdAt,
};
const selectPublic = (x: Executor) =>
  x.select(publicColumns).from(impactProject).innerJoin(organization, eq(organization.id, impactProject.ownerOrgId));

/** Keyset-paged by id: stable under inserts, and the cursor says nothing about row counts. */
export async function listPublicProjects(
  input: { cursor?: string; limit?: number | string } = {},
  x: Executor = db,
): Promise<PublicProjectPage> {
  const { cursor, limit } = parseInput(publicPageSchema, input);
  const rows = await selectPublic(x)
    .where(and(eq(impactProject.status, "ACTIVE"), cursor ? gt(impactProject.id, cursor) : undefined))
    .orderBy(asc(impactProject.id))
    .limit(limit + 1);
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

export async function getPublicProject(id: string, x: Executor = db): Promise<PublicProjectDetail> {
  if (!isUuid(id)) throw new NotFoundError(NOT_FOUND);
  const [row] = await selectPublic(x).where(and(eq(impactProject.id, id), eq(impactProject.status, "ACTIVE")));
  if (!row) throw new NotFoundError(NOT_FOUND);

  const verifierOrgNames = await reviewerNames(x, id);
  const [record] = await x
    .select({
      approved: sql<number>`count(*) filter (where ${evidenceSubmission.status} = 'APPROVED')::int`,
      anchored: sql<number>`count(*) filter (where ${evidenceSubmission.status} = 'ANCHORED')::int`,
    })
    .from(evidenceSubmission)
    .where(eq(evidenceSubmission.projectId, id));

  return { ...row, verifierOrgNames, record: record! };
}

async function reviewerNames(x: Executor, projectId: string): Promise<string[]> {
  const rows = await x
    .select({ name: organization.name })
    .from(projectAssignment)
    .innerJoin(organization, eq(organization.id, projectAssignment.verifierOrgId))
    .where(eq(projectAssignment.projectId, projectId))
    .orderBy(asc(organization.name));
  return rows.map((r) => r.name);
}

/** The verifier organisations assigned to a project, for anyone who may see the project. The public page names them too. */
export async function listProjectReviewers(actor: Actor | null, id: string, x: Executor = db): Promise<string[]> {
  const { row } = await loadVisible(x, actor, id);
  return reviewerNames(x, row.id);
}

/**
 * Totals across ACTIVE projects for the landing page. Counts only, nothing per site.
 * `approved` includes ANCHORED: an anchored record was approved first.
 */
export async function getPublicOverview(x: Executor = db): Promise<{ sites: number; approved: number; verifierOrgs: number }> {
  const [totals] = await x
    .select({
      sites: sql<number>`count(distinct ${impactProject.id})::int`,
      approved: sql<number>`(count(${evidenceSubmission.id}) filter (where ${evidenceSubmission.status} in ('APPROVED', 'ANCHORED')))::int`,
    })
    .from(impactProject)
    .leftJoin(evidenceSubmission, eq(evidenceSubmission.projectId, impactProject.id))
    .where(eq(impactProject.status, "ACTIVE"));
  const [verifiers] = await x
    .select({ n: sql<number>`count(distinct ${projectAssignment.verifierOrgId})::int` })
    .from(projectAssignment)
    .innerJoin(impactProject, eq(impactProject.id, projectAssignment.projectId))
    .where(eq(impactProject.status, "ACTIVE"));
  return { sites: totals!.sites, approved: totals!.approved, verifierOrgs: verifiers!.n };
}

// ---------------------------------------------------------------------------------------

export async function createProject(actor: Actor, input: CreateProjectInput, x: Executor = db): Promise<ProjectDetail> {
  const data = parseInput(createSchema, input);

  return x.transaction(async (tx) => {
    const ctx = await actorContext(tx, actor);
    const mine = ctx.memberships.find((m) => m.orgId === data.ownerOrgId);
    if (!mine) throw new NotFoundError("organisation not found");
    if (mine.orgType !== "OWNER") throw new ForbiddenError("only an OWNER organisation can own a project");
    if (mine.role !== "owner" && mine.role !== "admin") throw new ForbiddenError("only an owner or admin of the organisation may create a project");

    const boundary: GeoPolygon = { type: "Polygon", coordinates: data.boundary.coordinates };
    const saltHex = randomBytes(32).toString("hex");
    const commitment = await locationCommitment(saltHex, boundary);
    const [lon, lat] = fuzzCentroid(polygonCentroid(boundary.coordinates[0]!));

    const [row] = await tx
      .insert(impactProject)
      .values({
        ownerOrgId: data.ownerOrgId,
        title: data.title,
        description: data.description,
        activityType: data.activityType,
        claimedQuantity: data.claimedQuantity?.toString(),
        claimedUnit: data.claimedUnit,
        toleranceMeters: data.toleranceMeters,
        fuzzedCentroid: { type: "Point", coordinates: [lon, lat] },
        locationCommitment: commitment,
      })
      .returning();
    await tx
      .insert(projectPrivateLocation)
      .values({ projectId: row!.id, boundary, locationSalt: Buffer.from(saltHex, "hex") });

    // A self-intersecting ring makes every later ST_Covers answer meaningless.
    const [check] = await tx.execute<{ valid: boolean; reason: string }>(sql`
      select ST_IsValid(boundary::geometry) as valid, ST_IsValidReason(boundary::geometry) as reason
      from project_private_location where project_id = ${row!.id}`);
    if (!check!.valid) throw new ValidationError(`boundary is not a valid polygon: ${check!.reason}`);

    return { ...summarise(row!, "owner"), exact: { boundary, locationSalt: saltHex } };
  });
}

export async function getProject(actor: Actor | null, id: string, x: Executor = db): Promise<ProjectDetail> {
  const { row, access } = await loadVisible(x, actor, id);
  return detail(x, row, access);
}

/** Never carries geometry: the list is for the Atlas, which asks `getProject` for the rest. */
export async function listProjects(actor: Actor | null, x: Executor = db): Promise<ProjectSummary[]> {
  const ctx = await actorContext(x, actor);
  const assignedIds = ctx.verifierOrgIds.length
    ? (
        await x
          .select({ id: projectAssignment.projectId })
          .from(projectAssignment)
          .where(inArray(projectAssignment.verifierOrgId, ctx.verifierOrgIds))
      ).map((r) => r.id)
    : [];

  const rows = await x
    .select()
    .from(impactProject)
    .where(
      or(
        eq(impactProject.status, "ACTIVE"),
        ctx.orgIds.length ? inArray(impactProject.ownerOrgId, ctx.orgIds) : undefined,
        assignedIds.length ? inArray(impactProject.id, assignedIds) : undefined,
      ),
    )
    .orderBy(desc(impactProject.createdAt));

  const assigned = new Set(assignedIds);
  return rows.map((row) =>
    summarise(row, ctx.orgIds.includes(row.ownerOrgId) ? "owner" : assigned.has(row.id) ? "verifier" : "public"),
  );
}

/**
 * Projects whose EXACT boundary covers the point. Only projects the caller already holds
 * exact geometry for are searched: answering this for anyone else would let them find a
 * site by bisection with point queries.
 */
export async function findProjectsCovering(actor: Actor | null, point: GeoPoint, x: Executor = db): Promise<ProjectSummary[]> {
  const [lon, lat] = parseInput(lonLat, point.coordinates);
  const ctx = await actorContext(x, actor);
  if (!ctx.orgIds.length) return [];

  const assignedIds = ctx.verifierOrgIds.length
    ? (
        await x
          .select({ id: projectAssignment.projectId })
          .from(projectAssignment)
          .where(inArray(projectAssignment.verifierOrgId, ctx.verifierOrgIds))
      ).map((r) => r.id)
    : [];

  const rows = await x
    .select({ project: impactProject })
    .from(impactProject)
    .innerJoin(projectPrivateLocation, eq(projectPrivateLocation.projectId, impactProject.id))
    .where(
      and(
        sql`ST_Covers(${projectPrivateLocation.boundary}, ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography)`,
        or(inArray(impactProject.ownerOrgId, ctx.orgIds), assignedIds.length ? inArray(impactProject.id, assignedIds) : undefined),
      ),
    );
  const assigned = new Set(assignedIds);
  return rows.map(({ project }) => summarise(project, ctx.orgIds.includes(project.ownerOrgId) ? "owner" : assigned.has(project.id) ? "verifier" : "public"));
}

export async function updateProject(actor: Actor, id: string, patch: UpdateProjectInput, x: Executor = db): Promise<ProjectDetail> {
  const data = parseInput(updateSchema, patch);

  return x.transaction(async (tx) => {
    const row = await loadForOwnerWrite(tx, actor, id);
    if (data.status && !NEXT_STATUS[row.status].includes(data.status)) {
      throw new ConflictError(`a ${row.status} project cannot become ${data.status}`);
    }
    // Reviewers judge evidence against the name, the claim and the tolerance, and the proof page
    // shows them beside every approval. Once evidence has been sent, they are what was reviewed.
    const changesWhatWasReviewed =
      (data.title !== undefined && data.title !== row.title) ||
      (data.claimedQuantity !== undefined && (row.claimedQuantity === null || data.claimedQuantity !== Number(row.claimedQuantity))) ||
      (data.claimedUnit !== undefined && data.claimedUnit !== row.claimedUnit) ||
      (data.toleranceMeters !== undefined && data.toleranceMeters !== row.toleranceMeters);
    if (changesWhatWasReviewed) {
      const [sent] = await tx
        .select({ id: evidenceSubmission.id })
        .from(evidenceSubmission)
        .where(and(eq(evidenceSubmission.projectId, id), ne(evidenceSubmission.status, "DRAFT")))
        .limit(1);
      if (sent) throw new ConflictError("The name, the claim and the tolerance are fixed once evidence has been sent, because reviewers judge the evidence against them.");
    }
    const [updated] = await tx
      .update(impactProject)
      .set({
        ...data,
        claimedQuantity: data.claimedQuantity?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(impactProject.id, id))
      .returning();
    if (data.status && data.status !== row.status) {
      await appendAuditEvent(tx, {
        orgId: row.ownerOrgId,
        eventType: "PROJECT_STATUS_CHANGED",
        actorUserId: actor.userId,
        payload: { projectId: id, from: row.status, to: data.status },
      });
    }
    return detail(tx, updated!, "owner");
  });
}

/** Only a DRAFT with no submissions. Anything else is history. */
export async function deleteProject(actor: Actor, id: string, x: Executor = db): Promise<void> {
  await x.transaction(async (tx) => {
    const row = await loadForOwnerWrite(tx, actor, id);
    if (row.status !== "DRAFT") throw new ConflictError("only a DRAFT project can be deleted");
    const [any] = await tx.select({ id: evidenceSubmission.id }).from(evidenceSubmission).where(eq(evidenceSubmission.projectId, id)).limit(1);
    if (any) throw new ConflictError("a project with submissions cannot be deleted");
    await tx.delete(projectPrivateLocation).where(eq(projectPrivateLocation.projectId, id));
    await tx.delete(impactProject).where(eq(impactProject.id, id));
  });
}
