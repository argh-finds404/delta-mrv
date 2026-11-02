import { bigint, char, check, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { evidenceSubmission } from "./evidence";

// Append-only: REVOKE and triggers live in the hand-written 0002 migration.

export const decision = pgEnum("decision", ["APPROVE", "REJECT", "REQUEST_MORE_PROOF"]);

export const reviewDecision = pgTable(
  "review_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => evidenceSubmission.id),
    round: integer("round").notNull(),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => user.id),
    reviewerOrgId: uuid("reviewer_org_id")
      .notNull()
      .references(() => organization.id),
    decision: decision("decision").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("review_decision_reason_min_length", sql`char_length(${t.reason}) >= 20`)],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    seq: bigint("seq", { mode: "number" }).notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    prevEventHash: char("prev_event_hash", { length: 64 }).notNull(),
    eventHash: char("event_hash", { length: 64 }).notNull(),
    // null for system-originated events
    actorUserId: uuid("actor_user_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // the one unique declared here: the hash chain's position is its identity
  (t) => [unique("audit_event_org_id_seq_unique").on(t.orgId, t.seq)],
);
