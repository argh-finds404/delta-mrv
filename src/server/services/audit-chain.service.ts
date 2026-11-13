import "server-only";
import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auditEvent } from "../db/schema";
import type { Executor } from "./access";

// The hash-chained audit log (docs/02-ARCHITECTURE.md §4.5). One chain per organisation: the
// organisation that owns the record the event changed (a review of a claimant's submission is
// on the claimant's chain, naming the reviewing organisation). Appended inside the caller's
// transaction, under a per-organisation advisory lock, so concurrent appends never fork it.

export const GENESIS = "0".repeat(64);
const PREFIX = "DELTA_AUDIT_V1:";

export type AuditEventType =
  | "SUBMISSION_FINALIZED"
  | "SUBMISSION_SUPPLEMENTED"
  | "FORENSICS_COMPLETED"
  | "REVIEW_DECISION"
  | "ANCHOR_CONFIRMED"
  | "VERIFIER_ASSIGNED"
  | "PROJECT_STATUS_CHANGED";

/** What is hashed: the whole event except its own hash, so type, actor, time and order are covered too. */
export type AuditBody = { orgId: string; seq: number; eventType: string; actorUserId: string | null; createdAt: string; payload: unknown };

/**
 * eventHash = SHA256("DELTA_AUDIT_V1:" + prevEventHash + ":" + canonicalize(body)), RFC 8785.
 * shortcut: lives in src/server until the maintainer approves it into src/lib/crypto/ (frozen);
 * until then scripts/ cannot import it, so chain verification runs from the service and tests.
 */
export function auditEventHash(prevEventHash: string, body: AuditBody): string {
  const canonical = canonicalize(body);
  if (canonical === undefined) throw new Error("audit event body is not serialisable");
  return createHash("sha256").update(`${PREFIX}${prevEventHash}:${canonical}`).digest("hex");
}

export async function appendAuditEvent(
  x: Executor,
  event: { orgId: string; eventType: AuditEventType; actorUserId: string | null; payload: Record<string, unknown> },
): Promise<{ seq: number; eventHash: string }> {
  return x.transaction(async (tx) => {
    // held to the end of the outermost transaction, so the event commits with the change it records
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`audit:${event.orgId}`}))`);
    const [head] = await tx
      .select({ seq: auditEvent.seq, hash: auditEvent.eventHash })
      .from(auditEvent)
      .where(eq(auditEvent.orgId, event.orgId))
      .orderBy(desc(auditEvent.seq))
      .limit(1);
    const seq = (head?.seq ?? 0) + 1;
    const prevEventHash = head?.hash ?? GENESIS;
    // milliseconds, set here, so verification reproduces the exact string that was hashed
    const createdAt = new Date();
    const eventHash = auditEventHash(prevEventHash, { ...event, seq, createdAt: createdAt.toISOString() });
    await tx.insert(auditEvent).values({ ...event, seq, prevEventHash, eventHash, createdAt });
    return { seq, eventHash };
  });
}

type ChainRow = Pick<typeof auditEvent.$inferSelect, "orgId" | "seq" | "eventType" | "actorUserId" | "createdAt" | "payload" | "prevEventHash" | "eventHash">;
export type ChainVerdict = { ok: boolean; firstBadSeq: number | null; reason: string | null };

/** Walks one organisation's rows in order from genesis; the first wrong sequence number and why. */
export function verifyChainRows(rows: ChainRow[]): ChainVerdict {
  let prev = GENESIS;
  let expected = 1;
  for (const r of [...rows].sort((a, b) => a.seq - b.seq)) {
    const bad = (reason: string): ChainVerdict => ({ ok: false, firstBadSeq: r.seq, reason });
    if (r.seq !== expected) return bad(`expected sequence ${expected}: an event is missing`);
    if (r.prevEventHash !== prev) return bad("does not link to the previous event");
    const body = { orgId: r.orgId, seq: r.seq, eventType: r.eventType, actorUserId: r.actorUserId, createdAt: r.createdAt.toISOString(), payload: r.payload };
    if (auditEventHash(r.prevEventHash, body) !== r.eventHash) return bad("event hash does not match its contents");
    prev = r.eventHash;
    expected++;
  }
  return { ok: true, firstBadSeq: null, reason: null };
}

export type ChainReport = { orgId: string; events: number } & ChainVerdict;

/** Verifies every organisation's chain, or one. What scripts/verify-audit-chain.ts will print. */
export async function verifyAuditChains(x: Executor = db, orgId?: string): Promise<ChainReport[]> {
  const orgs = orgId ? [orgId] : (await x.selectDistinct({ orgId: auditEvent.orgId }).from(auditEvent)).map((r) => r.orgId);
  const reports: ChainReport[] = [];
  for (const id of orgs) {
    const rows = await x.select().from(auditEvent).where(eq(auditEvent.orgId, id)).orderBy(asc(auditEvent.seq));
    reports.push({ orgId: id, events: rows.length, ...verifyChainRows(rows) });
  }
  return reports;
}
