import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { locationCommitment } from "../../lib/crypto/location";
import { db } from "../db/client";
import {
  activityType,
  evidenceSubmission,
  impactProject,
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
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { fuzzCentroid, polygonCentroid } from "../../lib/geo/fuzz";

export type ProjectAccess = "owner" | "verifier" | "public";

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
    const [updated] = await tx
      .update(impactProject)
      .set({
        ...data,
        claimedQuantity: data.claimedQuantity?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(impactProject.id, id))
      .returning();
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
