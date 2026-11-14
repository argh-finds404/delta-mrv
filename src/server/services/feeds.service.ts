import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { anchorBatch, anchorLeaf, evidenceSubmission, impactProject, organization } from "../db/schema";
import { isUuid, type Executor } from "./access";
import { NotFoundError } from "./errors";

// Pull-only public feeds (docs/05-ROUTES.md; S10 push webhooks stay cut): a project's records as they
// are anchored, and the full contents of every confirmed batch, so anyone can keep a mirror and
// prove later that a record was removed. Session-blind like every public read: no actor, no
// path to project_private_location, nothing exact about a site.

export type AnchoredEntry = {
  submissionId: string;
  /** Set for a survival check-up: the record it revisits. */
  followsSubmissionId: string | null;
  manifestHash: string;
  approvedAtIso: string | null;
  batchId: number;
  merkleRoot: string;
  txHash: string | null;
  anchoredAt: Date;
};

export type ProjectFeed = { project: { id: string; title: string; ownerOrgName: string; updatedAt: Date }; entries: AnchoredEntry[] };

/** A project's anchored records, newest first. Draft and unknown projects: one 404. */
export async function projectFeed(projectId: string, limit = 50, x: Executor = db): Promise<ProjectFeed> {
  const notFound = new NotFoundError("project not found");
  if (!isUuid(projectId)) throw notFound;
  const [project] = await x
    .select({ id: impactProject.id, title: impactProject.title, ownerOrgName: organization.name, status: impactProject.status, updatedAt: impactProject.updatedAt })
    .from(impactProject)
    .innerJoin(organization, eq(organization.id, impactProject.ownerOrgId))
    .where(eq(impactProject.id, projectId));
  if (!project || project.status === "DRAFT") throw notFound;
  const rows = await x
    .select({
      submissionId: evidenceSubmission.id,
      followsSubmissionId: evidenceSubmission.followsSubmissionId,
      manifestHash: anchorLeaf.manifestHash,
      approvedAtIso: sql<string | null>`case when ${anchorLeaf.manifestVersion} = ${evidenceSubmission.manifestVersion} then ${evidenceSubmission.manifest}->>'approvedAtIso' end`,
      batchId: anchorBatch.id,
      merkleRoot: anchorBatch.merkleRoot,
      txHash: anchorBatch.txHash,
      anchoredAt: anchorBatch.confirmedAt,
    })
    .from(anchorLeaf)
    .innerJoin(anchorBatch, eq(anchorBatch.id, anchorLeaf.batchId))
    .innerJoin(evidenceSubmission, eq(evidenceSubmission.id, anchorLeaf.submissionId))
    .where(and(eq(evidenceSubmission.projectId, projectId), eq(anchorBatch.status, "CONFIRMED"), eq(evidenceSubmission.status, "ANCHORED")))
    .orderBy(desc(anchorBatch.confirmedAt), asc(anchorLeaf.leafIndex))
    .limit(Math.min(Math.max(limit, 1), 200));
  const entries = rows.map((r) => ({ ...r, anchoredAt: r.anchoredAt! }));
  return { project: { id: project.id, title: project.title, ownerOrgName: project.ownerOrgName, updatedAt: entries[0]?.anchoredAt ?? project.updatedAt }, entries };
}

export type PublicBatch = {
  id: number;
  chainId: number;
  contractAddress: string;
  merkleRoot: string;
  txHash: string | null;
  blockNumber: number | null;
  confirmedAt: Date;
  leafCount: number;
  /** Every leaf, in tree order: enough to rebuild the root with @openzeppelin/merkle-tree and compare it with the chain. */
  leaves: { leafIndex: number; submissionId: string; manifestHash: string; approvedAtIso: string | null }[];
};

/** One confirmed batch and all its leaves. Pending, failed and unknown batches: 404. */
export async function publicBatch(id: number, x: Executor = db): Promise<PublicBatch> {
  const notFound = new NotFoundError("batch not found");
  if (!Number.isSafeInteger(id) || id < 1) throw notFound;
  const [b] = await x.select().from(anchorBatch).where(and(eq(anchorBatch.id, id), eq(anchorBatch.status, "CONFIRMED")));
  if (!b) throw notFound;
  const leaves = await x
    .select({
      leafIndex: anchorLeaf.leafIndex,
      submissionId: anchorLeaf.submissionId,
      manifestHash: anchorLeaf.manifestHash,
      approvedAtIso: sql<string | null>`case when ${anchorLeaf.manifestVersion} = ${evidenceSubmission.manifestVersion} then ${evidenceSubmission.manifest}->>'approvedAtIso' end`,
    })
    .from(anchorLeaf)
    .innerJoin(evidenceSubmission, eq(evidenceSubmission.id, anchorLeaf.submissionId))
    .where(eq(anchorLeaf.batchId, id))
    .orderBy(asc(anchorLeaf.leafIndex));
  return { id: b.id, chainId: b.chainId, contractAddress: b.contractAddress, merkleRoot: b.merkleRoot, txHash: b.txHash, blockNumber: b.blockNumber, confirmedAt: b.confirmedAt!, leafCount: b.leafCount, leaves };
}

/** The newest confirmed batches, without their leaves. */
export async function listPublicBatches(limit = 50, x: Executor = db) {
  return x
    .select({ id: anchorBatch.id, merkleRoot: anchorBatch.merkleRoot, leafCount: anchorBatch.leafCount, txHash: anchorBatch.txHash, blockNumber: anchorBatch.blockNumber, confirmedAt: anchorBatch.confirmedAt })
    .from(anchorBatch)
    .where(eq(anchorBatch.status, "CONFIRMED"))
    .orderBy(desc(anchorBatch.id))
    .limit(Math.min(Math.max(limit, 1), 200));
}
