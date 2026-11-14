import { char, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { geographyPoint, geographyPolygon, bytea } from "./types";
import { organization, user } from "./auth";

// Indexes and uniques are deliberately not declared here: every §6 index lives
// in the hand-written migration, so none is defined twice.

export const activityType = pgEnum("activity_type", [
  "MANGROVE",
  "WETLAND",
  "RIVER_CLEANUP",
  "TREE_PLANTING",
  "COASTAL_BELT",
]);
export const projectStatus = pgEnum("project_status", ["DRAFT", "ACTIVE", "CLOSED"]);

/** Holds nothing exact: the boundary and salt are in project_private_location. */
export const impactProject = pgTable("impact_project", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerOrgId: uuid("owner_org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  activityType: activityType("activity_type").notNull(),
  claimedQuantity: numeric("claimed_quantity"),
  claimedUnit: text("claimed_unit"),
  // nullable: a DRAFT project exists before its boundary is drawn
  fuzzedCentroid: geographyPoint("fuzzed_centroid"),
  locationCommitment: char("location_commitment", { length: 64 }),
  toleranceMeters: integer("tolerance_meters").notNull().default(100),
  // Survival check-ups: months between re-photographs of each approved record. Null: none promised.
  checkupMonths: integer("checkup_months"),
  status: projectStatus("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Exact geometry. Spatial checks join here explicitly. */
export const projectPrivateLocation = pgTable("project_private_location", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => impactProject.id),
  boundary: geographyPolygon("boundary").notNull(),
  locationSalt: bytea("location_salt").notNull(),
});

export const projectAssignment = pgTable("project_assignment", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => impactProject.id),
  verifierOrgId: uuid("verifier_org_id")
    .notNull()
    .references(() => organization.id),
  assignedByUserId: uuid("assigned_by_user_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectFunder = pgTable("project_funder", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => impactProject.id),
  funderOrgId: uuid("funder_org_id")
    .notNull()
    .references(() => organization.id),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
