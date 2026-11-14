import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Manifest } from "../../lib/crypto/manifest";
import { ACCEPTED_EVIDENCE_TYPES, EXTENSION, HEIC_REFUSAL, MAX_EVIDENCE_BYTES, sniffImageType } from "../../lib/forensics/mime";
import { assertTransition } from "../../lib/state-machine";
import { db } from "../db/client";
import {
  anchorBatch,
  anchorLeaf,
  auditEvent,
  evidenceFile,
  evidenceSubmission,
  forensicFinding,
  impactProject,
  organization,
  projectAssignment,
  projectFunder,
  reviewDecision,
  submissionStatus,
} from "../db/schema";
import { evidenceStorage, localStorage } from "../storage";
import type { StoragePort } from "../storage/port";
import type { GeoPoint } from "../db/schema/types";
import { actorContext, assignedVerifierOrgs, isUuid, parseInput, type Actor, type ActorContext, type Executor } from "./access";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { appendAuditEvent } from "./audit-chain.service";
import { checkCaptureAttestation, type StoredAttestation } from "./capture-attestation";
import { dHashOf, FORENSICS_JOB, RULE_VERSION, type ExifFacts } from "./forensics.service";
import { enqueueJob } from "./jobs.service";

// Reads, and intake: draft, scoped upload token, finalize, supplement (Stage 4b).

export type SubmissionSummary = {
  id: string;
  projectId: string;
  ownerOrgId: string;
  status: (typeof evidenceSubmission.$inferSelect)["status"];
  round: number;
  riskScore: string | null;
  riskBand: (typeof evidenceSubmission.$inferSelect)["riskBand"];
  submittedAt: Date;
  /** A survival check-up: the approved record it revisits. Null for an ordinary submission. */
  followsSubmissionId: string | null;
};

type SubmissionRow = typeof evidenceSubmission.$inferSelect;
type Status = SubmissionRow["status"];

const NOT_FOUND = "submission not found";

export const toSummary = (r: SubmissionRow): SubmissionSummary => ({
  id: r.id,
  projectId: r.projectId,
  ownerOrgId: r.ownerOrgId,
  status: r.status,
  round: r.round,
  riskScore: r.riskScore,
  riskBand: r.riskBand,
  submittedAt: r.submittedAt,
  followsSubmissionId: r.followsSubmissionId,
});

/**
 * Which statuses of one project's submissions the caller may see (docs/04-AUTH.md §5):
 * the owner org everything; an assigned verifier org everything past DRAFT; a funder org
 * linked through project_funder only APPROVED and ANCHORED. Null: nothing at all.
 */
async function visibleStatuses(
  x: Executor,
  ctx: ActorContext,
  project: { id: string; ownerOrgId: string },
): Promise<((s: Status) => boolean) | null> {
  if (ctx.orgIds.includes(project.ownerOrgId)) return () => true;

  const rules: ((s: Status) => boolean)[] = [];
  if ((await assignedVerifierOrgs(x, project.id, ctx.verifierOrgIds)).length) rules.push((s) => s !== "DRAFT");
  if (ctx.funderOrgIds.length) {
    const [link] = await x
      .select({ id: projectFunder.id })
      .from(projectFunder)
      .where(and(eq(projectFunder.projectId, project.id), inArray(projectFunder.funderOrgId, ctx.funderOrgIds)))
      .limit(1);
    if (link) rules.push((s) => s === "APPROVED" || s === "ANCHORED");
  }
  return rules.length ? (s) => rules.some((r) => r(s)) : null;
}

export async function getSubmission(actor: Actor | null, id: string, x: Executor = db): Promise<SubmissionSummary> {
  if (!isUuid(id)) throw new NotFoundError(NOT_FOUND);
  const [row] = await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id));
  if (!row) throw new NotFoundError(NOT_FOUND);
  const visible = await visibleStatuses(x, await actorContext(x, actor), { id: row.projectId, ownerOrgId: row.ownerOrgId });
  if (!visible || !visible(row.status)) throw new NotFoundError(NOT_FOUND);
  return toSummary(row);
}

/**
 * An evidence original's bytes, visible exactly when its submission is to getSubmission.
 * Missing, malformed and hidden are one 404. Never public: not even an APPROVED original.
 */
export async function openEvidenceFile(
  actor: Actor | null,
  fileId: string,
  x: Executor = db,
  storage: StoragePort = evidenceStorage,
): Promise<{ stream: ReadableStream<Uint8Array>; mime: string; size: number }> {
  const notFound = new NotFoundError("evidence file not found");
  if (!isUuid(fileId)) throw notFound;
  const [row] = await x
    .select({ key: evidenceFile.storageKey, mime: evidenceFile.mime, s: evidenceSubmission })
    .from(evidenceFile)
    .innerJoin(evidenceSubmission, eq(evidenceSubmission.id, evidenceFile.submissionId))
    .where(eq(evidenceFile.id, fileId));
  if (!row) throw notFound;
  const visible = await visibleStatuses(x, await actorContext(x, actor), { id: row.s.projectId, ownerOrgId: row.s.ownerOrgId });
  if (!visible || !visible(row.s.status)) throw notFound;

  const stored = await storage.get(row.key);
  // a visible row with no bytes is evidence loss (THREAT_MODEL T10): fail loudly, never a 404
  if (!stored) throw new Error(`evidence file ${fileId} has no stored bytes at its storage key`);
  return { stream: stored.stream, mime: row.mime, size: stored.size };
}

export async function listSubmissionsForProject(actor: Actor | null, projectId: string, x: Executor = db): Promise<SubmissionSummary[]> {
  if (!isUuid(projectId)) return [];
  const [project] = await x.select({ id: impactProject.id, ownerOrgId: impactProject.ownerOrgId }).from(impactProject).where(eq(impactProject.id, projectId));
  if (!project) return [];
  const visible = await visibleStatuses(x, await actorContext(x, actor), project);
  if (!visible) return [];
  const rows = await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.projectId, projectId)).orderBy(desc(evidenceSubmission.submittedAt));
  return rows.filter((r) => visible(r.status)).map(toSummary);
}

export type FindingView = Pick<
  typeof forensicFinding.$inferSelect,
  "id" | "evidenceFileId" | "kind" | "severity" | "reason" | "evidence" | "ruleVersion" | "createdAt"
> & {
  /** An operator's latest conclusion about a matchRef this finding carries (admin.service). Never names the other side. */
  resolution?: { outcome: "CONFIRMED" | "CLEARED"; reason: string; at: Date };
};

/**
 * A submission's findings, with the submission (and so its cached score) beside them: the
 * score is never served without the findings that explain it (docs/10-FORENSICS.md §6).
 * Visible exactly when the submission is. Cross-organisation matches carry only a matchRef.
 */
export async function listFindings(actor: Actor | null, submissionId: string, x: Executor = db): Promise<{ submission: SubmissionSummary; findings: FindingView[] }> {
  const submission = await getSubmission(actor, submissionId, x);
  const findings = await x
    .select({
      id: forensicFinding.id,
      evidenceFileId: forensicFinding.evidenceFileId,
      kind: forensicFinding.kind,
      severity: forensicFinding.severity,
      reason: forensicFinding.reason,
      evidence: forensicFinding.evidence,
      ruleVersion: forensicFinding.ruleVersion,
      createdAt: forensicFinding.createdAt,
    })
    .from(forensicFinding)
    .where(eq(forensicFinding.submissionId, submission.id))
    .orderBy(forensicFinding.createdAt, forensicFinding.kind, forensicFinding.id);

  // an operator's conclusion about a match is on this submission's own chain, under its matchRef
  const refs = findings.map((f) => (f.evidence as { matchRef?: unknown }).matchRef).filter((r): r is string => typeof r === "string");
  if (!refs.length) return { submission, findings };
  const resolved = await x
    .select({ payload: auditEvent.payload, at: auditEvent.createdAt })
    .from(auditEvent)
    .where(and(eq(auditEvent.orgId, submission.ownerOrgId), eq(auditEvent.eventType, "MATCH_RESOLVED"), sql`${auditEvent.payload}->>'submissionId' = ${submission.id}`))
    .orderBy(auditEvent.seq);
  const latest = new Map<string, NonNullable<FindingView["resolution"]>>();
  for (const e of resolved) {
    const p = e.payload as { matchRef: string; outcome: "CONFIRMED" | "CLEARED"; reason: string };
    latest.set(p.matchRef, { outcome: p.outcome, reason: p.reason, at: e.at });
  }
  return {
    submission,
    findings: findings.map((f) => {
      const resolution = latest.get(String((f.evidence as { matchRef?: unknown }).matchRef));
      return resolution ? { ...f, resolution } : f;
    }),
  };
}

export type EvidenceFileView = {
  id: string;
  role: "BEFORE" | "AFTER" | "SUPPLEMENT";
  round: number;
  mime: string;
  sizeBytes: number;
  /** Computed by the server from the stored bytes: the record. */
  sha256: string;
  /** What the device computed before upload, when it sent one. A weak signal, never the record. */
  clientSha256: string | null;
  /** 64 characters of 0 and 1; null until the forensic pass has read the file. */
  dhash: string | null;
  /** As the file's own metadata states them. Null means the file does not say: never an inferred value. */
  capturedAt: Date | null;
  gps: GeoPoint | null;
  exif: ExifFacts | null;
};

export type SubmissionDetail = {
  submission: SubmissionSummary;
  access: "owner" | "verifier";
  project: { id: string; title: string; activityType: (typeof impactProject.$inferSelect)["activityType"]; ownerOrgName: string; toleranceMeters: number; status: (typeof impactProject.$inferSelect)["status"] };
  /** Every file of every round, oldest round first, before then after then supplements. */
  files: EvidenceFileView[];
  /** This submission's events on its owner's audit chain, oldest first. */
  events: { seq: number; eventType: string; createdAt: Date; eventHash: string }[];
  /** X2: the device signature sent with the pair, as checked at finalize. Null when none was sent. */
  capture: StoredAttestation | null;
};

/**
 * /submissions/[id] (docs/14-PAGE-SPEC.md §7): the full record of one submission, for the
 * organisation that owns it and for an assigned verifier organisation. Anyone else, a linked
 * funder included, gets the same 404 as a missing id: a funder reads the public proof page.
 * Events come without their payloads, because a decision's payload states the verdict and an
 * open round's verdicts stay hidden until the caller has voted (A4); getRoundDecisions is the
 * one place decisions are read from.
 */
export async function getSubmissionDetail(actor: Actor, id: string, x: Executor = db): Promise<SubmissionDetail> {
  const submission = await getSubmission(actor, id, x);
  const ctx = await actorContext(x, actor);
  const access = ctx.orgIds.includes(submission.ownerOrgId)
    ? "owner"
    : (await assignedVerifierOrgs(x, submission.projectId, ctx.verifierOrgIds)).length
      ? "verifier"
      : null;
  if (!access) throw new NotFoundError(NOT_FOUND);

  const [[project], files, events, [attested]] = await Promise.all([
    x
      .select({ id: impactProject.id, title: impactProject.title, activityType: impactProject.activityType, toleranceMeters: impactProject.toleranceMeters, status: impactProject.status, ownerOrgName: organization.name })
      .from(impactProject)
      .innerJoin(organization, eq(organization.id, impactProject.ownerOrgId))
      .where(eq(impactProject.id, submission.projectId)),
    x
      .select({
        id: evidenceFile.id,
        role: evidenceFile.role,
        round: evidenceFile.round,
        mime: evidenceFile.mime,
        sizeBytes: evidenceFile.sizeBytes,
        sha256: evidenceFile.sha256,
        clientSha256: evidenceFile.clientSha256,
        dhash: evidenceFile.dhash,
        capturedAt: evidenceFile.capturedAt,
        gps: evidenceFile.gps,
        exif: evidenceFile.exif,
      })
      .from(evidenceFile)
      .where(eq(evidenceFile.submissionId, submission.id))
      .orderBy(evidenceFile.round, sql`case ${evidenceFile.role} when 'BEFORE' then 0 when 'AFTER' then 1 else 2 end`, evidenceFile.createdAt, evidenceFile.id),
    x
      .select({ seq: auditEvent.seq, eventType: auditEvent.eventType, createdAt: auditEvent.createdAt, eventHash: auditEvent.eventHash })
      .from(auditEvent)
      .where(and(eq(auditEvent.orgId, submission.ownerOrgId), sql`${auditEvent.payload}->>'submissionId' = ${submission.id}`))
      .orderBy(asc(auditEvent.seq)),
    x.select({ capture: evidenceSubmission.captureAttestation }).from(evidenceSubmission).where(eq(evidenceSubmission.id, submission.id)),
  ]);
  return {
    submission,
    access,
    project: project!,
    files: files.map((f) => ({ ...f, exif: (f.exif as ExifFacts | null) ?? null })),
    events,
    capture: (attested?.capture as StoredAttestation | null) ?? null,
  };
}

export type PublicProof = {
  submission: {
    id: string;
    status: "APPROVED" | "ANCHORED";
    round: number;
    submittedAt: Date;
    anchored: boolean;
    /** A survival check-up: the approved record it revisits. */
    followsSubmissionId: string | null;
    /** The stored fingerprint of the sealed manifest: a verifier recomputes it, this is the claim. */
    manifestHash: string | null;
  };
  project: {
    id: string;
    title: string;
    activityType: (typeof impactProject.$inferSelect)["activityType"];
    claimedQuantity: string | null;
    claimedUnit: string | null;
    ownerOrgName: string;
    fuzzedLocation: (typeof impactProject.$inferSelect)["fuzzedCentroid"];
    locationCommitment: string | null;
  };
  files: { id: string; role: "BEFORE" | "AFTER" | "SUPPLEMENT"; round: number; sha256: string }[];
  decisions: { decision: (typeof reviewDecision.$inferSelect)["decision"]; reason: string; round: number; createdAt: Date; reviewerOrgName: string }[];
  /** The canonical document sealed at approval, exactly as stored: a verifier hashes it itself. Null for a record approved without one. */
  manifest: Manifest | null;
  /**
   * X2: the device signature over the first round's pair, when one was sent and verified at
   * finalize; the proof page checks it again in the visitor's browser. The public key is a
   * pseudonym of the signing browser, nothing more.
   */
  capture: { publicKey: string; signature: string; signedAt: string } | null;
  /** The batch this record's leaf is in, whatever its state, with the leaf's proof path. Null until it is batched. */
  anchor: {
    batchId: number;
    status: (typeof anchorBatch.$inferSelect)["status"];
    merkleRoot: string;
    chainId: number;
    contractAddress: string;
    txHash: string | null;
    blockNumber: number | null;
    confirmedAt: Date | null;
    leafIndex: number;
    proof: string[];
  } | null;
};

/**
 * The public proof dossier's data (docs/05-ROUTES.md §4): an APPROVED or ANCHORED submission,
 * its files' SHA-256, every decision with its reason, and the project as the public may see it
 * (fuzzed point and commitment, never the site). Anything else, or nothing: one 404. No actor:
 * there is no session branch and no path to project_private_location.
 */
export async function getPublicProof(submissionId: string, x: Executor = db): Promise<PublicProof> {
  if (!isUuid(submissionId)) throw new NotFoundError(NOT_FOUND);
  const [row] = await x
    .select({ s: evidenceSubmission, p: impactProject, ownerOrgName: organization.name })
    .from(evidenceSubmission)
    .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
    .innerJoin(organization, eq(organization.id, evidenceSubmission.ownerOrgId))
    .where(and(eq(evidenceSubmission.id, submissionId), inArray(evidenceSubmission.status, ["APPROVED", "ANCHORED"])));
  if (!row) throw new NotFoundError(NOT_FOUND);

  const [files, decisions, anchors] = await Promise.all([
    x
      .select({ id: evidenceFile.id, role: evidenceFile.role, round: evidenceFile.round, sha256: evidenceFile.sha256 })
      .from(evidenceFile)
      .where(eq(evidenceFile.submissionId, submissionId))
      .orderBy(evidenceFile.round, sql`case ${evidenceFile.role} when 'BEFORE' then 0 when 'AFTER' then 1 else 2 end`, evidenceFile.id),
    x
      .select({ decision: reviewDecision.decision, reason: reviewDecision.reason, round: reviewDecision.round, createdAt: reviewDecision.createdAt, reviewerOrgName: organization.name })
      .from(reviewDecision)
      .innerJoin(organization, eq(organization.id, reviewDecision.reviewerOrgId))
      .where(eq(reviewDecision.submissionId, submissionId))
      .orderBy(reviewDecision.createdAt, reviewDecision.id),
    x
      .select({
        batchId: anchorBatch.id,
        status: anchorBatch.status,
        merkleRoot: anchorBatch.merkleRoot,
        chainId: anchorBatch.chainId,
        contractAddress: anchorBatch.contractAddress,
        txHash: anchorBatch.txHash,
        blockNumber: anchorBatch.blockNumber,
        confirmedAt: anchorBatch.confirmedAt,
        leafIndex: anchorLeaf.leafIndex,
        proof: anchorLeaf.proof,
      })
      .from(anchorLeaf)
      .innerJoin(anchorBatch, eq(anchorBatch.id, anchorLeaf.batchId))
      .where(and(eq(anchorLeaf.submissionId, submissionId), eq(anchorLeaf.manifestVersion, row.s.manifestVersion))),
  ]);
  const { s, p } = row;
  const anchor = anchors[0];
  const attested = s.captureAttestation as StoredAttestation | null;
  return {
    submission: {
      id: s.id,
      status: s.status as "APPROVED" | "ANCHORED",
      round: s.round,
      submittedAt: s.submittedAt,
      anchored: s.status === "ANCHORED",
      followsSubmissionId: s.followsSubmissionId,
      manifestHash: s.manifestHash,
    },
    project: {
      id: p.id,
      title: p.title,
      activityType: p.activityType,
      claimedQuantity: p.claimedQuantity,
      claimedUnit: p.claimedUnit,
      ownerOrgName: row.ownerOrgName,
      fuzzedLocation: p.fuzzedCentroid,
      locationCommitment: p.locationCommitment,
    },
    files,
    decisions,
    manifest: (s.manifest as Manifest | null) ?? null,
    capture: attested?.verified ? { publicKey: attested.publicKey, signature: attested.signature, signedAt: attested.signedAt } : null,
    anchor: anchor ? { ...anchor, proof: anchor.proof as string[] } : null,
  };
}

export type ProofLookupHit = {
  submissionId: string;
  projectTitle: string;
  status: "APPROVED" | "ANCHORED";
  matchedBy: "PROOF_ID" | "FILE_SHA256" | "TRANSACTION";
};

const PUBLIC_PROOF_STATUSES = ["APPROVED", "ANCHORED"] as const;

/**
 * /verify (docs/16-AMENDMENTS-v2.md A7): a proof id, a file's SHA-256 (hashed in the browser,
 * only the hash is sent), or an anchor transaction hash, matched against public proofs only.
 * Everything it can return is already on a public proof page.
 */
export async function lookupProofs(query: string, x: Executor = db): Promise<ProofLookupHit[]> {
  const q = query.trim().toLowerCase();
  const base = () =>
    x
      .selectDistinct({ submissionId: evidenceSubmission.id, projectTitle: impactProject.title, status: evidenceSubmission.status })
      .from(evidenceSubmission)
      .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId));
  const visible = inArray(evidenceSubmission.status, [...PUBLIC_PROOF_STATUSES]);
  const tag = (matchedBy: ProofLookupHit["matchedBy"]) => (rows: { submissionId: string; projectTitle: string; status: Status }[]) =>
    rows.map((r) => ({ ...r, status: r.status as ProofLookupHit["status"], matchedBy }));

  if (isUuid(q)) return tag("PROOF_ID")(await base().where(and(eq(evidenceSubmission.id, q), visible)));
  if (/^[0-9a-f]{64}$/.test(q)) {
    return tag("FILE_SHA256")(
      await base().innerJoin(evidenceFile, eq(evidenceFile.submissionId, evidenceSubmission.id)).where(and(eq(evidenceFile.sha256, q), visible)).limit(20),
    );
  }
  if (/^0x[0-9a-f]{64}$/.test(q)) {
    return tag("TRANSACTION")(
      await base()
        .innerJoin(anchorLeaf, eq(anchorLeaf.submissionId, evidenceSubmission.id))
        .innerJoin(anchorBatch, eq(anchorBatch.id, anchorLeaf.batchId))
        .where(and(sql`lower(${anchorBatch.txHash}) = ${q}`, visible))
        .limit(50),
    );
  }
  throw new ValidationError("Enter a proof id, a transaction hash, or a file's SHA-256 fingerprint.");
}

export type SubmissionStatusCounts = Record<Status, number>;

/**
 * How many submissions the caller may see, by status, across every project, counted in the
 * database. Same rule as getSubmission: the owner org everything, an assigned verifier org
 * everything past DRAFT, a linked funder org only APPROVED and ANCHORED. Anyone else: zeros.
 */
export async function countSubmissionsByStatus(actor: Actor, x: Executor = db): Promise<SubmissionStatusCounts> {
  const counts = Object.fromEntries(submissionStatus.enumValues.map((s) => [s, 0])) as SubmissionStatusCounts;
  const ctx = await actorContext(x, actor);
  if (!ctx.orgIds.length) return counts;

  const [assigned, linked] = await Promise.all([
    ctx.verifierOrgIds.length
      ? x.select({ id: projectAssignment.projectId }).from(projectAssignment).where(inArray(projectAssignment.verifierOrgId, ctx.verifierOrgIds))
      : [],
    ctx.funderOrgIds.length
      ? x.select({ id: projectFunder.projectId }).from(projectFunder).where(inArray(projectFunder.funderOrgId, ctx.funderOrgIds))
      : [],
  ]);
  const assignedIds = new Set(assigned.map((r) => r.id));
  const linkedIds = new Set(linked.map((r) => r.id));

  const rows = await x
    .select({ projectId: evidenceSubmission.projectId, ownerOrgId: evidenceSubmission.ownerOrgId, status: evidenceSubmission.status, n: sql<number>`count(*)::int` })
    .from(evidenceSubmission)
    .where(
      or(
        inArray(evidenceSubmission.ownerOrgId, ctx.orgIds),
        assignedIds.size ? inArray(evidenceSubmission.projectId, [...assignedIds]) : undefined,
        linkedIds.size ? inArray(evidenceSubmission.projectId, [...linkedIds]) : undefined,
      ),
    )
    .groupBy(evidenceSubmission.projectId, evidenceSubmission.ownerOrgId, evidenceSubmission.status);

  for (const r of rows) {
    const visible =
      ctx.orgIds.includes(r.ownerOrgId) ||
      (assignedIds.has(r.projectId) && r.status !== "DRAFT") ||
      (linkedIds.has(r.projectId) && (r.status === "APPROVED" || r.status === "ANCHORED"));
    if (visible) counts[r.status] += r.n;
  }
  return counts;
}

// ---------------------------------------------------------------------------------------
// Intake (docs/01-FEATURE-LOCK.md, draft and direct upload). The browser uploads straight to
// private storage with a token scoped to one path the server chose; finalize then reads the
// bytes back and judges those. Nothing the client says about a file is authoritative.

const fileSchema = z.object({
  pathname: z.string().min(1).max(512),
  clientSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "must be 64 lowercase hex characters")
    .optional(),
});
const pairSchema = z.object({
  // X2: an optional device signature over the pair; checked, never required (capture-attestation.ts)
  attestation: z.unknown().optional(),
  files: z
    .array(fileSchema.extend({ role: z.enum(["BEFORE", "AFTER"]) }))
    .length(2, "a submission is exactly one BEFORE and one AFTER photo")
    .refine((fs) => new Set(fs.map((f) => f.role)).size === 2, "a submission is exactly one BEFORE and one AFTER photo")
    .refine((fs) => new Set(fs.map((f) => f.pathname)).size === 2, "the BEFORE and AFTER photos must be different uploads"),
});
// a survival check-up: the original record's photo is the "before"; only today's photo is sent
const checkupSchema = z.object({
  attestation: z.unknown().optional(),
  files: z.array(fileSchema.extend({ role: z.literal("AFTER") }), { error: "a check-up is exactly one new photo, sent as AFTER" }).length(1, "a check-up is exactly one new photo, sent as AFTER"),
});
const intakeSchema = z.object({ attestation: z.unknown().optional(), files: z.array(fileSchema.extend({ role: z.enum(["BEFORE", "AFTER"]) })).min(1).max(2) });
const tokenSchema = z.object({ role: z.enum(["BEFORE", "AFTER", "SUPPLEMENT"]), contentType: z.string().min(1).max(100) });

/** Every upload for a submission lives under this prefix; a token is only issued inside it. */
export const uploadPrefix = (s: { id: string; projectId: string; ownerOrgId: string }) => `org/${s.ownerOrgId}/project/${s.projectId}/${s.id}/`;

/** The caller's own submission, locked for the write, in one of `allowed` statuses. Strangers: 404. */
async function loadOwnForWrite(x: Executor, actor: Actor, id: string, allowed: Status[]): Promise<SubmissionRow> {
  if (!isUuid(id)) throw new NotFoundError(NOT_FOUND);
  const [row] = await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id)).for("update");
  if (!row) throw new NotFoundError(NOT_FOUND);
  const ctx = await actorContext(x, actor);
  if (!ctx.orgIds.includes(row.ownerOrgId)) throw new NotFoundError(NOT_FOUND);
  if (!allowed.includes(row.status)) throw new ConflictError(`a ${row.status} submission does not accept this`);
  return row;
}

/**
 * Starts a submission. Any member of the project's owning organisation may: field workers are
 * plain members (the Stage 4e gate signs in as one). Anyone else, platform admins included: 404.
 */
export async function createDraft(actor: Actor, projectId: string, x: Executor = db): Promise<SubmissionSummary> {
  if (!isUuid(projectId)) throw new NotFoundError("project not found");
  const [project] = await x
    .select({ id: impactProject.id, ownerOrgId: impactProject.ownerOrgId, status: impactProject.status })
    .from(impactProject)
    .where(eq(impactProject.id, projectId));
  const ctx = await actorContext(x, actor);
  if (!project || !ctx.orgIds.includes(project.ownerOrgId)) throw new NotFoundError("project not found");
  if (project.status !== "ACTIVE") throw new ConflictError("only an ACTIVE project takes new evidence");
  const [row] = await x
    .insert(evidenceSubmission)
    .values({ projectId, ownerOrgId: project.ownerOrgId, submittedByUserId: actor.userId, status: "DRAFT" })
    .returning();
  return toSummary(row!);
}

/**
 * Starts a survival check-up of an approved record: a draft that takes one new photo of the same
 * spot, reviewed like any submission. A check-up of a check-up revisits the original record, so
 * every visit hangs off one record. Owners' members only; an unapproved record cannot be revisited.
 */
export async function createCheckupDraft(actor: Actor, recordId: string, x: Executor = db): Promise<SubmissionSummary> {
  if (!isUuid(recordId)) throw new NotFoundError(NOT_FOUND);
  const [row] = await x
    .select({ s: evidenceSubmission, projectStatus: impactProject.status })
    .from(evidenceSubmission)
    .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
    .where(eq(evidenceSubmission.id, recordId));
  const ctx = await actorContext(x, actor);
  if (!row || !ctx.orgIds.includes(row.s.ownerOrgId)) throw new NotFoundError(NOT_FOUND);
  if (row.s.status !== "APPROVED" && row.s.status !== "ANCHORED") throw new ConflictError("Only an approved record can be revisited for a check-up.");
  if (row.projectStatus !== "ACTIVE") throw new ConflictError("only an ACTIVE project takes new evidence");
  const [draft] = await x
    .insert(evidenceSubmission)
    .values({ projectId: row.s.projectId, ownerOrgId: row.s.ownerOrgId, submittedByUserId: actor.userId, status: "DRAFT", followsSubmissionId: row.s.followsSubmissionId ?? row.s.id })
    .returning();
  return toSummary(draft!);
}

/**
 * A token for one direct upload. The server names the file (a user-supplied name is a path
 * traversal vector) and the token can write that one path, once, within the limits.
 */
export async function issueUploadToken(
  actor: Actor,
  submissionId: string,
  input: { role: "BEFORE" | "AFTER" | "SUPPLEMENT"; contentType: string },
  x: Executor = db,
  storage: StoragePort = evidenceStorage,
): Promise<{ pathname: string; clientToken: string }> {
  const data = parseInput(tokenSchema, input);
  if (/hei[cf]/i.test(data.contentType)) throw new ValidationError(HEIC_REFUSAL);
  const type = ACCEPTED_EVIDENCE_TYPES.find((t) => t === data.contentType);
  if (!type) throw new ValidationError("a photo must be a JPEG, PNG or WebP image");
  const s = await loadOwnForWrite(x, actor, submissionId, data.role === "SUPPLEMENT" ? ["NEEDS_MORE_PROOF"] : ["DRAFT"]);
  if (s.followsSubmissionId && data.role === "BEFORE") throw new ValidationError("a check-up takes no BEFORE photo: the record it revisits is the before");
  const pathname = `${uploadPrefix(s)}${data.role.toLowerCase()}-${randomUUID()}.${EXTENSION[type]}`;
  const clientToken = await storage.uploadToken(pathname, { maxBytes: MAX_EVIDENCE_BYTES, contentTypes: ACCEPTED_EVIDENCE_TYPES });
  return { pathname, clientToken };
}

/**
 * Development only (PUT /api/dev/storage): one browser upload into the local-disk store, if the
 * token grants exactly it. Null when this server does not keep evidence on its own disk, which
 * is every production server. Finalize still reads the bytes back and judges them.
 */
export async function acceptLocalUpload(token: string, pathname: string, contentType: string, bytes: Uint8Array): Promise<boolean | null> {
  if (!localStorage) return null;
  return localStorage.accept(token, pathname, contentType, bytes);
}

/** Reads one upload back from storage and judges the bytes themselves: size, type, hash. */
async function readStoredUpload(storage: StoragePort, s: SubmissionRow, pathname: string) {
  if (!pathname.startsWith(uploadPrefix(s)) || pathname.includes("..")) throw new ValidationError("that file is not part of this submission");
  const stored = await storage.get(pathname);
  if (!stored) throw new ValidationError("a photo has not finished uploading; upload it again");
  const tooBig = new ValidationError("a photo is larger than 5 MB");
  if (stored.size > MAX_EVIDENCE_BYTES) {
    await stored.stream.cancel();
    throw tooBig;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stored.stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    total += r.value.length;
    if (total > MAX_EVIDENCE_BYTES) {
      await reader.cancel(); // the size the store reported is not trusted either
      throw tooBig;
    }
    chunks.push(r.value);
  }
  const bytes = Buffer.concat(chunks);
  const mime = sniffImageType(bytes);
  if (mime === "image/heic") throw new ValidationError(HEIC_REFUSAL);
  if (!mime) throw new ValidationError("a file is not a JPEG, PNG or WebP image");
  // the dHash is taken here, in the same transaction as the file row, so every committed file
  // is searchable at once: two near-duplicates finalized together cannot miss each other
  const dhash = await dHashOf(bytes).catch(() => {
    throw new ValidationError("a file could not be read as an image; export it again as JPEG, PNG or WebP");
  });
  return { mime, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), dhash };
}

/** The server's hash is the record; a different hash from the device is a MEDIUM finding (docs/10). */
async function recordHashMismatches(x: Executor, rows: { id: string; submissionId: string; sha256: string; clientSha256: string | null }[]) {
  const mismatched = rows.filter((r) => r.clientSha256 && r.clientSha256 !== r.sha256);
  if (!mismatched.length) return;
  await x.insert(forensicFinding).values(
    mismatched.map((r) => ({
      submissionId: r.submissionId,
      evidenceFileId: r.id,
      kind: "CLIENT_HASH_MISMATCH" as const,
      severity: "MEDIUM" as const,
      reason: "The file changed between the device and the server: the fingerprint the phone computed does not match the stored file.",
      evidence: { clientSha256: r.clientSha256, serverSha256: r.sha256 },
      ruleVersion: RULE_VERSION,
    })),
  );
}

/**
 * DRAFT → PENDING_FORENSICS in one transaction: check both uploads exist and are within limits,
 * hash the stored bytes, write the files, raise any hash mismatch, queue the forensics job.
 */
export async function finalizeSubmission(
  actor: Actor,
  submissionId: string,
  input: { files: { role: "BEFORE" | "AFTER"; pathname: string; clientSha256?: string }[]; attestation?: unknown },
  x: Executor = db,
  storage: StoragePort = evidenceStorage,
): Promise<SubmissionSummary> {
  const raw = parseInput(intakeSchema, input);
  return x.transaction(async (tx) => {
    const s = await loadOwnForWrite(tx, actor, submissionId, ["DRAFT"]);
    const data = parseInput(s.followsSubmissionId ? checkupSchema : pairSchema, raw);
    const stored = await Promise.all(data.files.map((f) => readStoredUpload(storage, s, f.pathname)));
    assertTransition(s.status, "PENDING_FORENSICS");
    // against the server's own fingerprints of the stored bytes, never the client's
    const capture = checkCaptureAttestation(data.attestation, s.projectId, data.files.map((f, i) => ({ role: f.role, sha256: stored[i]!.sha256 })));
    const rows = await tx
      .insert(evidenceFile)
      .values(data.files.map((f, i) => ({ submissionId: s.id, role: f.role, storageKey: f.pathname, ...stored[i]!, clientSha256: f.clientSha256 ?? null, round: s.round })))
      .returning();
    await recordHashMismatches(tx, rows);
    const [updated] = await tx.update(evidenceSubmission).set({ status: "PENDING_FORENSICS", captureAttestation: capture }).where(eq(evidenceSubmission.id, s.id)).returning();
    await appendAuditEvent(tx, {
      orgId: s.ownerOrgId,
      eventType: "SUBMISSION_FINALIZED",
      actorUserId: actor.userId,
      payload: {
        submissionId: s.id,
        projectId: s.projectId,
        round: s.round,
        from: "DRAFT",
        status: "PENDING_FORENSICS",
        files: rows.map((r) => ({ role: r.role, sha256: r.sha256 })),
        // the link from a check-up to its record is on the chain, whose head the manifest seals
        ...(s.followsSubmissionId ? { followsSubmissionId: s.followsSubmissionId } : {}),
        // the chain fixes the signature too: the column alone could be edited later
        ...(capture ? { capture: { keyId: capture.keyId, verified: capture.verified, signature: capture.signature } } : {}),
      },
    });
    await enqueueJob({ kind: FORENSICS_JOB, payload: { submissionId: s.id, round: s.round }, idempotencyKey: `forensics:${s.id}:${s.round}` }, tx);
    return toSummary(updated!);
  });
}

/**
 * More proof after a reviewer asked for it: NEEDS_MORE_PROOF → IN_REVIEW in a new round, the
 * supplement checked like any other upload and a forensics pass queued for it.
 */
export async function addSupplement(
  actor: Actor,
  submissionId: string,
  input: { pathname: string; clientSha256?: string },
  x: Executor = db,
  storage: StoragePort = evidenceStorage,
): Promise<SubmissionSummary> {
  const data = parseInput(fileSchema, input);
  return x.transaction(async (tx) => {
    const s = await loadOwnForWrite(tx, actor, submissionId, ["NEEDS_MORE_PROOF"]);
    const stored = await readStoredUpload(storage, s, data.pathname);
    assertTransition(s.status, "IN_REVIEW");
    const round = s.round + 1;
    const rows = await tx
      .insert(evidenceFile)
      .values({ submissionId: s.id, role: "SUPPLEMENT", storageKey: data.pathname, ...stored, clientSha256: data.clientSha256 ?? null, round })
      .returning();
    await recordHashMismatches(tx, rows);
    const [updated] = await tx.update(evidenceSubmission).set({ status: "IN_REVIEW", round }).where(eq(evidenceSubmission.id, s.id)).returning();
    await appendAuditEvent(tx, {
      orgId: s.ownerOrgId,
      eventType: "SUBMISSION_SUPPLEMENTED",
      actorUserId: actor.userId,
      payload: { submissionId: s.id, projectId: s.projectId, round, from: "NEEDS_MORE_PROOF", status: "IN_REVIEW", files: rows.map((r) => ({ role: r.role, sha256: r.sha256 })) },
    });
    await enqueueJob({ kind: FORENSICS_JOB, payload: { submissionId: s.id, round }, idempotencyKey: `forensics:${s.id}:${round}` }, tx);
    return toSummary(updated!);
  });
}
