import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "../db/client";
import { job } from "../db/schema";
import type { Executor } from "./access";

// The Postgres job queue (docs/01-FEATURE-LOCK.md M6). Claiming is one UPDATE over a
// `FOR UPDATE SKIP LOCKED` subquery, so concurrent workers never take the same row. A worker
// owns a job only while `attempts` still equals what its claim set: a stuck job that is
// reclaimed bumps it, so the slow original can no longer finish or fail it. Handlers must be
// idempotent, because a reclaim can run one twice.

/** A RUNNING job whose lock is older than this is treated as abandoned and claimable again. */
export const STUCK_AFTER_MS = 10 * 60 * 1000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CAP_MS = 30 * 60_000;

/** 30 s, 1 min, 2 min, ... capped at 30 min. */
export const backoffMs = (attempt: number) => Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));

export type JobContext = { jobId: string; attempt: number; x: Executor };
export type JobHandler = (payload: unknown, ctx: JobContext) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/** Handlers are registered by kind, once, from the module that owns the work. */
export function registerJobHandler(kind: string, handler: JobHandler) {
  handlers.set(kind, handler);
}

export async function enqueueJob(
  input: { kind: string; payload: unknown; idempotencyKey: string; runAt?: Date; maxAttempts?: number },
  x: Executor = db,
): Promise<{ id: string; created: boolean }> {
  const [row] = await x
    .insert(job)
    .values({ kind: input.kind, payload: input.payload, idempotencyKey: input.idempotencyKey, runAt: input.runAt, maxAttempts: input.maxAttempts })
    .onConflictDoNothing({ target: job.idempotencyKey })
    .returning({ id: job.id });
  if (row) return { id: row.id, created: true };
  const [existing] = await x.select({ id: job.id }).from(job).where(eq(job.idempotencyKey, input.idempotencyKey));
  return { id: existing!.id, created: false };
}

export type ClaimedJob = { id: string; kind: string; payload: unknown; attempts: number; maxAttempts: number };

const stale = () => sql`clock_timestamp() - ${`${STUCK_AFTER_MS} milliseconds`}::interval`;

/** Takes the next due job (or an abandoned one) and marks it RUNNING. Null when there is none. */
export async function claimJob(x: Executor = db, opts: { kinds?: string[] } = {}): Promise<ClaimedJob | null> {
  const onlyKinds = opts.kinds?.length ? sql`AND ${inArray(job.kind, opts.kinds)}` : sql``;
  const [row] = await x.execute<{ id: string; kind: string; payload: unknown; attempts: number; max_attempts: number }>(sql`
    UPDATE ${job}
    SET status = 'RUNNING', locked_at = clock_timestamp(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM ${job}
      WHERE attempts < max_attempts
        AND ((status = 'PENDING' AND run_at <= now()) OR (status = 'RUNNING' AND locked_at < ${stale()}))
        ${onlyKinds}
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, kind, payload, attempts, max_attempts`);
  return row ? { id: row.id, kind: row.kind, payload: row.payload, attempts: row.attempts, maxAttempts: row.max_attempts } : null;
}

export type RunOutcome = { outcome: "empty" } | { id: string; outcome: "done" | "retry" | "failed" | "superseded" };

/** Claims one job, runs its handler, and records the result if this worker still owns it. */
export async function runOneJob(x: Executor = db, opts: { kinds?: string[] } = {}): Promise<RunOutcome> {
  const claimed = await claimJob(x, opts);
  if (!claimed) return { outcome: "empty" };
  const { id, kind, attempts, maxAttempts } = claimed;
  const owned = and(eq(job.id, id), eq(job.status, "RUNNING"), eq(job.attempts, attempts));

  try {
    const handler = handlers.get(kind);
    if (!handler) throw new Error(`no handler registered for job kind "${kind}"`);
    await handler(claimed.payload, { jobId: id, attempt: attempts, x });
    const done = await x.update(job).set({ status: "DONE", lockedAt: null, lastError: null }).where(owned).returning({ id: job.id });
    return { id, outcome: done.length ? "done" : "superseded" };
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
    const failed = attempts >= maxAttempts;
    const res = await x
      .update(job)
      .set(
        failed
          ? { status: "FAILED", lockedAt: null, lastError: message }
          : { status: "PENDING", lockedAt: null, lastError: message, runAt: sql`now() + ${`${backoffMs(attempts)} milliseconds`}::interval` },
      )
      .where(owned)
      .returning({ id: job.id });
    return { id, outcome: res.length ? (failed ? "failed" : "retry") : "superseded" };
  }
}

/**
 * Runs due jobs until the queue is empty or the time budget is spent. A job whose worker died on
 * its last allowed attempt becomes STUCK, which is what the admin retry is for.
 */
export async function drainJobs(opts: { budgetMs?: number; max?: number } = {}, x: Executor = db) {
  const { budgetMs = 20_000, max = 50 } = opts;
  await x
    .update(job)
    .set({ status: "STUCK", lockedAt: null })
    .where(and(eq(job.status, "RUNNING"), sql`${job.attempts} >= ${job.maxAttempts}`, sql`${job.lockedAt} < ${stale()}`));
  const start = Date.now();
  const tally = { done: 0, retry: 0, failed: 0, superseded: 0 };
  for (let i = 0; i < max && Date.now() - start < budgetMs; i++) {
    const r = await runOneJob(x);
    if (r.outcome === "empty") break;
    tally[r.outcome]++;
  }
  return tally;
}

/** Drains after the response is sent, so the request that queued work never waits for it. */
export function drainAfterResponse() {
  after(() =>
    drainJobs().catch((e: unknown) => {
      console.error("job drain after response failed", e instanceof Error ? e.message : e);
    }),
  );
}

/** Puts a FAILED or STUCK job back in the queue with a fresh attempt budget. */
export async function retryJob(id: string, x: Executor = db): Promise<boolean> {
  // shortcut: no caller check here; the only caller will be the admin panel (Stage 6e), which
  // must check for an admin role once one exists (no platform admin in the schema yet)
  const res = await x
    .update(job)
    .set({ status: "PENDING", attempts: 0, lastError: null, lockedAt: null, runAt: sql`now()` })
    .where(and(eq(job.id, id), inArray(job.status, ["FAILED", "STUCK"])))
    .returning({ id: job.id });
  return res.length > 0;
}
