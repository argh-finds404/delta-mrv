import "server-only";
import { and, eq, lt, notExists, sql } from "drizzle-orm";
import { db } from "../db/client";
import { evidenceFile, evidenceSubmission } from "../db/schema";
import { blobStorage } from "../storage/blob";
import type { StoragePort } from "../storage/port";
import type { Executor } from "./access";
import { registerJobHandler } from "./jobs.service";
import { uploadPrefix } from "./submissions.service";

export const SWEEP_JOB = "drafts.sweep";
const BATCH = 200;

/**
 * Deletes drafts older than 24 hours that never finalized, uploads first (docs/01 M3). A draft
 * has no evidence_file rows by definition, so nothing on record is ever lost here; a draft
 * that finalized has left DRAFT and is never touched. Returns how many drafts went.
 */
export async function sweepAbandonedDrafts(x: Executor = db, storage: StoragePort = blobStorage): Promise<number> {
  const abandoned = (e: Executor) =>
    and(
      eq(evidenceSubmission.status, "DRAFT"),
      lt(evidenceSubmission.submittedAt, sql`now() - interval '24 hours'`),
      notExists(e.select({ one: sql`1` }).from(evidenceFile).where(eq(evidenceFile.submissionId, evidenceSubmission.id))),
    );
  const stale = await x.select({ id: evidenceSubmission.id }).from(evidenceSubmission).where(abandoned(x)).limit(BATCH);
  let removed = 0;
  for (const { id } of stale) {
    // One draft at a time under its row lock: finalize takes the same lock, so it either ran
    // first (and the draft is no longer DRAFT) or waits and then finds nothing. The blobs go
    // last, inside the lock; if that fails the delete rolls back and the next sweep retries.
    removed += await x.transaction(async (tx) => {
      const [s] = await tx
        .select({ id: evidenceSubmission.id, projectId: evidenceSubmission.projectId, ownerOrgId: evidenceSubmission.ownerOrgId })
        .from(evidenceSubmission)
        .where(and(eq(evidenceSubmission.id, id), abandoned(tx)))
        .for("update", { skipLocked: true });
      if (!s) return 0;
      await tx.delete(evidenceSubmission).where(eq(evidenceSubmission.id, s.id));
      // shortcut: a token issued just before this can still land one orphan blob under the
      // deleted prefix; harmless (private, never referenced), add a storage-side sweep if it matters
      await storage.deletePrefix(uploadPrefix(s));
      return 1;
    });
  }
  return removed;
}

registerJobHandler(SWEEP_JOB, async (_payload, { x }) => {
  await sweepAbandonedDrafts(x);
});
