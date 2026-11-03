import { bigint, char, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { evidenceSubmission } from "./evidence";

// Async, anchoring and platform groups. Indexes: see the hand-written 0003.

export const jobStatus = pgEnum("job_status", ["PENDING", "RUNNING", "DONE", "FAILED", "STUCK"]);
export const anchorStatus = pgEnum("anchor_status", ["PENDING", "SUBMITTED", "CONFIRMED", "FAILED"]);

export const job = pgTable("job", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  status: jobStatus("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lastError: text("last_error"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Identity bigint, so the row id is the contract's uint256 batchId.
export const anchorBatch = pgTable("anchor_batch", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  merkleRoot: char("merkle_root", { length: 66 }).notNull(),
  chainId: integer("chain_id").notNull(),
  contractAddress: char("contract_address", { length: 42 }).notNull(),
  txHash: char("tx_hash", { length: 66 }),
  blockNumber: bigint("block_number", { mode: "number" }),
  status: anchorStatus("status").notNull().default("PENDING"),
  leafCount: integer("leaf_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const anchorLeaf = pgTable("anchor_leaf", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: bigint("batch_id", { mode: "number" })
    .notNull()
    .references(() => anchorBatch.id),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => evidenceSubmission.id),
  manifestHash: char("manifest_hash", { length: 64 }).notNull(),
  manifestVersion: integer("manifest_version").notNull(),
  leafIndex: integer("leaf_index").notNull(),
  proof: jsonb("proof").notNull(),
});

export const apiKey = pgTable("api_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: char("key_hash", { length: 64 }).notNull(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  scopes: text("scopes").array().notNull().default([]),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// webhook_endpoint and webhook_delivery are NOT built: docs/03-DATABASE.md §4
// names them but defines no columns, and S10 is first on the cut list.
