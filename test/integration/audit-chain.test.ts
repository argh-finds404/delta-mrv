// The hash-chained audit log (docs/02-ARCHITECTURE.md §4.5, docs/11 #5 and #6): appended inside
// the caller's transaction, one chain per organisation, verifiable from genesis, and a tampered
// row is found at its exact sequence number.
import { asc, eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "../../src/server/db/schema";
import { auditEvent, evidenceSubmission, organization } from "../../src/server/db/schema";
import { appendAuditEvent, auditEventHash, GENESIS, verifyAuditChains, verifyChainRows } from "../../src/server/services/audit-chain.service";
import { castDecision } from "../../src/server/services/reviews.service";
import { updateProject } from "../../src/server/services/projects.service";
import { client, inRollback, pgError, type Tx } from "./db";
import { actor, REASON, world } from "./fixtures";

afterAll(() => client.end());

const chainOf = (tx: Tx, orgId: string) => tx.select().from(auditEvent).where(eq(auditEvent.orgId, orgId)).orderBy(asc(auditEvent.seq));

describe("appendAuditEvent", () => {
  it("starts at seq 1 from 64 zeros, links each event to the last, and verifies", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const org = w.org.other.id;
      await appendAuditEvent(tx, { orgId: org, eventType: "PROJECT_STATUS_CHANGED", actorUserId: w.u.outsider.id, payload: { projectId: "p", from: "DRAFT", to: "ACTIVE" } });
      await appendAuditEvent(tx, { orgId: org, eventType: "PROJECT_STATUS_CHANGED", actorUserId: null, payload: { projectId: "p", from: "ACTIVE", to: "CLOSED" } });
      const rows = await chainOf(tx, org);
      expect(rows.map((r) => r.seq)).toEqual([1, 2]);
      expect(rows[0]!.prevEventHash).toBe(GENESIS);
      expect(rows[1]!.prevEventHash).toBe(rows[0]!.eventHash);
      expect(verifyChainRows(rows)).toEqual({ ok: true, firstBadSeq: null, reason: null });
      const [report] = await verifyAuditChains(tx, org);
      expect(report).toMatchObject({ orgId: org, events: 2, ok: true });
    }));

  it("the hash covers the event, not only its payload: a changed type, actor or time is caught", () => {
    const body = { orgId: "o", seq: 1, eventType: "REVIEW_DECISION", actorUserId: "u", createdAt: "2026-11-10T00:00:00.000Z", payload: { a: 1 } };
    const h = auditEventHash(GENESIS, body);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    for (const changed of [{ ...body, eventType: "X" }, { ...body, actorUserId: "v" }, { ...body, createdAt: "2026-11-10T00:00:00.001Z" }, { ...body, seq: 2 }, { ...body, payload: { a: 2 } }]) {
      expect(auditEventHash(GENESIS, changed)).not.toBe(h);
    }
    // key order is not content: RFC 8785 canonical form
    expect(auditEventHash(GENESIS, { payload: { a: 1 }, createdAt: body.createdAt, actorUserId: "u", eventType: body.eventType, seq: 1, orgId: "o" })).toBe(h);
  });
});

describe("verification", () => {
  it("a tampered row breaks the chain at exactly its sequence number (#6)", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const org = w.org.other.id;
      for (let i = 0; i < 5; i++) await appendAuditEvent(tx, { orgId: org, eventType: "PROJECT_STATUS_CHANGED", actorUserId: null, payload: { i } });
      const rows = await chainOf(tx, org);

      // in memory: a rewritten payload at seq 3
      const edited = rows.map((r) => (r.seq === 3 ? { ...r, payload: { i: 99 } } : r));
      expect(verifyChainRows(edited)).toEqual({ ok: false, firstBadSeq: 3, reason: "event hash does not match its contents" });
      // a deleted row at seq 2 shows as a gap
      expect(verifyChainRows(rows.filter((r) => r.seq !== 2))).toMatchObject({ ok: false, firstBadSeq: 3 });

      // in the database: only by switching the guard off, which the app's role cannot do
      await tx.execute(sql`alter table audit_event disable trigger audit_event_immutable`);
      await tx.execute(sql`update audit_event set payload = '{"i": 42}'::jsonb where org_id = ${org} and seq = 4`);
      await tx.execute(sql`alter table audit_event enable trigger audit_event_immutable`);
      const [report] = await verifyAuditChains(tx, org);
      expect(report).toMatchObject({ ok: false, firstBadSeq: 4 });
    }));

  it("UPDATE and DELETE on audit_event still raise", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await appendAuditEvent(tx, { orgId: w.org.other.id, eventType: "PROJECT_STATUS_CHANGED", actorUserId: null, payload: {} });
      const immutable = /append-only table: audit_event is immutable/;
      // each in its own savepoint: a raise aborts the transaction it happens in
      expect(await pgError(tx.transaction((t) => t.execute(sql`update audit_event set event_type = 'x' where org_id = ${w.org.other.id}`)))).toMatch(immutable);
      expect(await pgError(tx.transaction((t) => t.execute(sql`delete from audit_event where org_id = ${w.org.other.id}`)))).toMatch(immutable);
    }));
});

describe("concurrency", () => {
  it("two connections appending to one organisation at once never fork the chain", async () => {
    // Real concurrency needs committed rows and two real connections: this test commits into a
    // throwaway organisation, then removes it (the rows are append-only, so the org stays empty
    // of anything else and is named for what it is).
    const url = process.env.DATABASE_URL_UNPOOLED!;
    const [ca, cb] = [postgres(url, { max: 1, prepare: false }), postgres(url, { max: 1, prepare: false })];
    const [da, dbb] = [drizzle(ca, { schema }), drizzle(cb, { schema })];
    const tag = `audit-race-${Date.now()}`;
    const [org] = await da.insert(organization).values({ name: tag, slug: tag, orgType: "OWNER", createdAt: new Date() }).returning();
    try {
      const append = (d: typeof da, n: number) =>
        Promise.all(Array.from({ length: n }, (_, i) => appendAuditEvent(d, { orgId: org!.id, eventType: "PROJECT_STATUS_CHANGED", actorUserId: null, payload: { i } })));
      await Promise.all([append(da, 15), append(dbb, 15)]);
      const [report] = await verifyAuditChains(da, org!.id);
      expect(report).toMatchObject({ events: 30, ok: true });
    } finally {
      await Promise.all([ca.end(), cb.end()]);
    }
  });
});

describe("wired into every state change", () => {
  it("decisions and project activation append to the owner's chain, and the chain verifies", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      // world() activated the project: one event already
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);
      await castDecision(actor(w.u.v2), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);
      await updateProject(actor(w.u.ownerAdmin), w.project.id, { status: "CLOSED" }, tx);

      const rows = await chainOf(tx, w.org.owner.id);
      expect(rows.map((r) => [r.eventType, (r.payload as { to?: string; status?: string }).to ?? (r.payload as { status?: string }).status])).toEqual([
        ["PROJECT_STATUS_CHANGED", "ACTIVE"],
        ["REVIEW_DECISION", "IN_REVIEW"],
        ["REVIEW_DECISION", "APPROVED"],
        ["PROJECT_STATUS_CHANGED", "CLOSED"],
      ]);
      expect(rows[1]!.actorUserId).toBe(w.u.v1.id);
      // a review's event names the reviewing organisation, never on the reviewer's own chain
      expect(rows[1]!.payload).toMatchObject({ submissionId: w.submission.id, decision: "APPROVE", reviewerOrgId: w.org.verifier.id });
      expect(await chainOf(tx, w.org.verifier.id)).toEqual([]);
      const [s] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, w.submission.id));
      expect(s!.status).toBe("APPROVED");
      const [report] = await verifyAuditChains(tx, w.org.owner.id);
      expect(report).toMatchObject({ events: 4, ok: true });
    }));
});
