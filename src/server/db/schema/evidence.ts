import {
  char,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bit64, geographyPoint } from "./types";
import { organization, user } from "./auth";
import { impactProject } from "./projects";

export const submissionStatus = pgEnum("submission_status", [
  "DRAFT",
  "PENDING_FORENSICS",
  "IN_REVIEW",
  "NEEDS_MORE_PROOF",
  "ESCALATED",
  "APPROVED",
  "REJECTED",
  "ANCHORED",
]);
export const riskBand = pgEnum("risk_band", ["clear", "review", "concern"]);
export const evidenceRole = pgEnum("evidence_role", ["BEFORE", "AFTER", "SUPPLEMENT"]);
export const severity = pgEnum("severity", ["INFO", "LOW", "MEDIUM", "HIGH"]);
export const findingKind = pgEnum("finding_kind", [
  "EXACT_DUPLICATE_SAME_PROJECT",
  "EXACT_DUPLICATE_SAME_ORG",
  "EXACT_DUPLICATE_OTHER_ORG",
  "PERCEPTUAL_MATCH_SAME_PROJECT",
  "PERCEPTUAL_MATCH_SAME_ORG",
  "PERCEPTUAL_MATCH_OTHER_ORG",
  "GPS_INSIDE_BOUNDARY",
  "GPS_WITHIN_TOLERANCE",
  "GPS_OUTSIDE_BOUNDARY",
  "GPS_MISSING",
  "EXIF_TIMESTAMP_MISSING",
  "EXIF_TIMESTAMP_IMPLAUSIBLE",
  "EXIF_FULLY_STRIPPED",
  "NO_VISIBLE_CHANGE",
  "CLIENT_HASH_MISMATCH",
  "AI_OBSERVATION",
]);

export const evidenceSubmission = pgTable("evidence_submission", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => impactProject.id),
  submittedByUserId: uuid("submitted_by_user_id")
    .notNull()
    .references(() => user.id),
  ownerOrgId: uuid("owner_org_id")
    .notNull()
    .references(() => organization.id),
  status: submissionStatus("status").notNull().default("DRAFT"),
  round: integer("round").notNull().default(1),
  // Cache of the pure function in src/lib/scoring/. Written by nothing else,
  // never shown without its findings, never gates a transition (A12).
  riskScore: numeric("risk_score"),
  riskBand: riskBand("risk_band"),
  scoringVersion: text("scoring_version"),
  manifest: jsonb("manifest"),
  manifestHash: char("manifest_hash", { length: 64 }),
  manifestVersion: integer("manifest_version").notNull().default(1),
  // set when the draft is created; the 24h draft sweep ages from it
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evidenceFile = pgTable("evidence_file", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => evidenceSubmission.id),
  role: evidenceRole("role").notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: char("sha256", { length: 64 }).notNull(),
  clientSha256: char("client_sha256", { length: 64 }),
  dhash: bit64("dhash"),
  exif: jsonb("exif"),
  gps: geographyPoint("gps"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  round: integer("round").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forensicFinding = pgTable("forensic_finding", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => evidenceSubmission.id),
  evidenceFileId: uuid("evidence_file_id").references(() => evidenceFile.id),
  kind: findingKind("kind").notNull(),
  severity: severity("severity").notNull(),
  reason: text("reason").notNull(),
  evidence: jsonb("evidence").notNull(),
  ruleVersion: text("rule_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
