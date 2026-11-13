import "server-only";
import { and, eq } from "drizzle-orm";
import { buildManifest, manifestHash } from "../../lib/crypto/manifest";
import { evidenceFile, evidenceSubmission, impactProject, reviewDecision } from "../db/schema";
import type { Executor } from "./access";

/**
 * A2 (docs/13-FEATURE-SPEC.md): at approval, the whole approved record as one canonical
 * document, and its hash. This is what gets anchored and what a stranger's browser recomputes.
 * Call inside the transaction that records the approving decision, after its audit event, so
 * `orgAuditChainHead` commits to that decision too.
 */
export async function sealManifest(
  tx: Executor,
  submissionId: string,
  approval: { verifierOrgId: string; approvedAt: Date; orgAuditChainHead: string },
): Promise<string | null> {
  const [row] = await tx
    .select({ s: evidenceSubmission, p: impactProject })
    .from(evidenceSubmission)
    .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
    .where(eq(evidenceSubmission.id, submissionId));
  if (!row) throw new Error(`cannot seal a manifest: submission ${submissionId} does not exist`);

  const files = await tx
    .select({ role: evidenceFile.role, round: evidenceFile.round, sha256: evidenceFile.sha256, dhash: evidenceFile.dhash })
    .from(evidenceFile)
    .where(eq(evidenceFile.submissionId, submissionId));
  // A manifest commits to at least one file. Intake refuses to finalize without one, so only a
  // record made outside intake reaches here empty; it is approved but can never be anchored.
  if (!files.length) return null;

  const approvals = await tx
    .select({ id: reviewDecision.id })
    .from(reviewDecision)
    .where(and(eq(reviewDecision.submissionId, submissionId), eq(reviewDecision.round, row.s.round), eq(reviewDecision.decision, "APPROVE")));

  const manifest = buildManifest({
    submissionId,
    projectId: row.s.projectId,
    ownerOrgId: row.s.ownerOrgId,
    verifierOrgId: approval.verifierOrgId,
    files,
    locationCommitment: row.p.locationCommitment,
    fuzzedLocation: row.p.fuzzedCentroid,
    approvedAtIso: approval.approvedAt.toISOString(),
    quorumReviewIds: approvals.map((a) => a.id),
    orgAuditChainHead: approval.orgAuditChainHead,
  });
  const hash = await manifestHash(manifest);
  await tx.update(evidenceSubmission).set({ manifest, manifestHash: hash }).where(eq(evidenceSubmission.id, submissionId));
  return hash;
}
