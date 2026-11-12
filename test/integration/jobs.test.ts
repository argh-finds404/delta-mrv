// The job queue (docs/AGENT_PROMPTS.md Stage 4a). Each test uses its own job kind, so the queue's
// other contents never interfere, and claims only that kind.
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ tx: undefined as unknown }));
vi.mock("../../src/server/db/client", () => ({
  get db() {
    return h.tx;
  },
}));

import { GET as drainRoute } from "../../src/app/api/internal/jobs/drain/route";
import * as schema from "../../src/server/db/schema";
import { job } from "../../src/server/db/schema";
import { backoffMs, claimJob, enqueueJob, registerJobHandler, retryJob, runOneJob, STUCK_AFTER_MS } from "../../src/server/services/jobs.service";
import { client, db, inRollback } from "./db";

afterAll(() => client.end());

const kindFor = (name: string) => `test.${name}.${randomUUID().slice(0, 8)}`;

describe("enqueue", () => {
  it("the same idempotency key twice creates one job", () =>
    inRollback(async (tx) => {
      const kind = kindFor("idem");
      const key = `${kind}:once`;
      const a = await enqueueJob({ kind, payload: { n: 1 }, idempotencyKey: key }, tx);
      const b = await enqueueJob({ kind, payload: { n: 2 }, idempotencyKey: key }, tx);
      expect(a.created).toBe(true);
      expect(b).toEqual({ id: a.id, created: false });
      expect(await tx.select().from(job).where(eq(job.kind, kind))).toHaveLength(1);
    }));
});

describe("claiming", () => {
  it("two workers on separate connections never take the same job", async () => {
    // Real concurrency needs committed rows and two real connections, so this test commits
    // and cleans up after itself (job is not an append-only table).
    const kind = kindFor("race");
    const url = process.env.DATABASE_URL_UNPOOLED!;
    const [ca, cb] = [postgres(url, { max: 1, prepare: false }), postgres(url, { max: 1, prepare: false })];
    const [wa, wb] = [drizzle(ca, { schema }), drizzle(cb, { schema })];
    try {
      const ids: string[] = [];
      for (let i = 0; i < 40; i++) ids.push((await enqueueJob({ kind, payload: { i }, idempotencyKey: `${kind}:${i}` }, db)).id);
      const worker = async (x: typeof wa) => {
        const got: string[] = [];
        for (;;) {
          const row = await claimJob(x, { kinds: [kind] });
          if (!row) return got;
          got.push(row.id);
        }
      };
      const [a, b] = await Promise.all([worker(wa), worker(wb)]);
      expect(a.filter((id) => b.includes(id))).toEqual([]); // nothing taken twice
      expect([...a, ...b].sort()).toEqual([...ids].sort()); // nothing left behind
      expect(a.length).toBeGreaterThan(0); // both really worked, or this proves nothing
      expect(b.length).toBeGreaterThan(0);
    } finally {
      await db.delete(job).where(eq(job.kind, kind));
      await Promise.all([ca.end(), cb.end()]);
    }
  });

  it("a job whose worker died is reclaimed after the timeout, and a live one is not", () =>
    inRollback(async (tx) => {
      const kind = kindFor("stuck");
      const dead = await enqueueJob({ kind, payload: {}, idempotencyKey: `${kind}:dead` }, tx);
      const live = await enqueueJob({ kind, payload: {}, idempotencyKey: `${kind}:live` }, tx);
      await tx.update(job).set({ status: "RUNNING", attempts: 1, lockedAt: sql`now() - ${`${STUCK_AFTER_MS * 2} milliseconds`}::interval` }).where(eq(job.id, dead.id));
      await tx.update(job).set({ status: "RUNNING", attempts: 1, lockedAt: sql`now()` }).where(eq(job.id, live.id));

      const claimed = await claimJob(tx, { kinds: [kind] });
      expect(claimed?.id).toBe(dead.id);
      expect(claimed?.attempts).toBe(2);
      expect(await claimJob(tx, { kinds: [kind] })).toBeNull();
    }));

  it("a slow worker whose job was reclaimed cannot overwrite the new worker's result", () =>
    inRollback(async (tx) => {
      const kind = kindFor("cas");
      let calls = 0;
      registerJobHandler(kind, async () => {
        calls++;
        if (calls === 1) {
          // while the first worker is still "running", the job times out and is taken over
          await tx.update(job).set({ lockedAt: sql`now() - ${`${STUCK_AFTER_MS * 2} milliseconds`}::interval` }).where(eq(job.kind, kind));
          const second = await claimJob(tx, { kinds: [kind] });
          expect(second).not.toBeNull();
        }
      });
      const { id } = await enqueueJob({ kind, payload: {}, idempotencyKey: `${kind}:1` }, tx);
      expect(await runOneJob(tx, { kinds: [kind] })).toEqual({ id, outcome: "superseded" });
      const [row] = await tx.select().from(job).where(eq(job.id, id));
      expect(row!.status).toBe("RUNNING"); // still the second worker's, untouched by the first
    }));
});

describe("failure and retry", () => {
  it("backs off exponentially with a cap", () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(backoffMs(30)).toBe(30 * 60_000);
  });

  it("a failing job waits out its backoff, then stops at max_attempts as FAILED", () =>
    inRollback(async (tx) => {
      const kind = kindFor("fail");
      registerJobHandler(kind, async () => {
        throw new Error("the river is too high");
      });
      const { id } = await enqueueJob({ kind, payload: {}, idempotencyKey: `${kind}:1`, maxAttempts: 3 }, tx);
      const read = async () => (await tx.select().from(job).where(eq(job.id, id)))[0]!;

      expect(await runOneJob(tx, { kinds: [kind] })).toEqual({ id, outcome: "retry" });
      const first = await read();
      expect([first.status, first.attempts, first.lastError]).toEqual(["PENDING", 1, "the river is too high"]);
      expect(first.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000); // backing off, not hot-looping
      expect(await runOneJob(tx, { kinds: [kind] })).toEqual({ outcome: "empty" }); // not due yet

      for (const attempt of [2, 3]) {
        await tx.update(job).set({ runAt: sql`now() - interval '1 second'` }).where(eq(job.id, id));
        expect((await runOneJob(tx, { kinds: [kind] }))).toEqual({ id, outcome: attempt === 3 ? "failed" : "retry" });
      }
      const last = await read();
      expect([last.status, last.attempts]).toEqual(["FAILED", 3]);
      expect(await runOneJob(tx, { kinds: [kind] })).toEqual({ outcome: "empty" });

      // the admin retry puts it back with a fresh budget
      expect(await retryJob(id, tx)).toBe(true);
      const again = await read();
      expect([again.status, again.attempts, again.lastError]).toEqual(["PENDING", 0, null]);
    }));

  it("a job with no registered handler fails loudly instead of vanishing", () =>
    inRollback(async (tx) => {
      const kind = kindFor("orphan");
      const { id } = await enqueueJob({ kind, payload: {}, idempotencyKey: `${kind}:1`, maxAttempts: 1 }, tx);
      expect(await runOneJob(tx, { kinds: [kind] })).toEqual({ id, outcome: "failed" });
      const [row] = await tx.select().from(job).where(inArray(job.id, [id]));
      expect(row!.lastError).toMatch(/no handler/);
    }));
});

describe("GET /api/internal/jobs/drain", () => {
  it("refuses without the right secret, and runs due jobs with it", () =>
    inRollback(async (tx) => {
      h.tx = tx;
      const previous = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "test-secret-that-is-long-enough";
      try {
        const call = (auth?: string) => drainRoute(new Request("http://test/api/internal/jobs/drain", { headers: auth ? { authorization: auth } : {} }));
        expect((await call()).status).toBe(401);
        expect((await call("Bearer wrong")).status).toBe(401);
        expect((await call("test-secret-that-is-long-enough")).status).toBe(401); // must be a Bearer token

        const kind = kindFor("drain");
        let ran = 0;
        registerJobHandler(kind, async () => {
          ran++;
        });
        await enqueueJob({ kind, payload: {}, idempotencyKey: `${kind}:1` }, tx);
        const ok = await call("Bearer test-secret-that-is-long-enough");
        expect(ok.status).toBe(200);
        expect(ran).toBe(1);
      } finally {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
      }
    }));
});
