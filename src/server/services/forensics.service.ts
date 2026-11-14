import "server-only";
import { createHash, createHmac } from "node:crypto";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import exifr from "exifr";
import sharp from "sharp";
import { z } from "zod";
import { requireEnv } from "../../env";
import { C2PA_RULE_VERSION, c2paFinding, type C2paReadResult, readC2pa } from "../forensics/c2pa";
import { checkClaim, claimFinding, CLAIMS_RULE_VERSION } from "../../lib/forensics/claims";
import { DHASH_RESIZE, hammingDistance, packDHash } from "../../lib/forensics/dhash";
import { scoreV1 } from "../../lib/scoring/v1";
import { assertTransition } from "../../lib/state-machine";
import { db } from "../db/client";
import { evidenceFile, evidenceSubmission, forensicFinding, impactProject } from "../db/schema";
import type { GeoPoint } from "../db/schema/types";
import { evidenceStorage } from "../storage";
import type { StoragePort } from "../storage/port";
import type { Executor } from "./access";
import { appendAuditEvent } from "./audit-chain.service";
import { enqueueJob, registerJobHandler } from "./jobs.service";
import { locateAgainstBoundary } from "./projects.service";

// The deterministic forensics pipeline (docs/10-FORENSICS.md §2, stages 1–7). Every check
// writes a forensic_finding with the severity from the §3 table and a reason a person can
// read. Severity is looked up, never computed. Nothing here approves, rejects or blocks.

export const RULE_VERSION = "forensics.v1";
export const FORENSICS_JOB = "forensics.run";
/** The advisory AI pass, queued once every deterministic finding of a round exists (docs/08 §3). */
export const AI_JOB = "ai.audit";
/** The advisory satellite cross-check (X1), queued once per submission, after the first round's checks. */
export const NDVI_JOB = "satellite.ndvi";
/** Hamming distance below which two photos are "the same picture" (docs/10 §5). */
export const PERCEPTUAL_THRESHOLD = 8;
/** Before/after distance below which the pair may show the same scene (docs/10 §3). */
export const NO_CHANGE_THRESHOLD = 4;

type FileRow = typeof evidenceFile.$inferSelect;
type SubmissionRow = typeof evidenceSubmission.$inferSelect;
type Kind = (typeof forensicFinding.$inferInsert)["kind"];
type Severity = (typeof forensicFinding.$inferInsert)["severity"];
export type PipelineFinding = { evidenceFileId: string | null; kind: Kind; severity: Severity; reason: string; evidence: Record<string, unknown>; ruleVersion: string };

// ---------------------------------------------------------------------------------------
// Stage 3: dHash. The one sharp pipeline (docs/02 §4.2): grayscale, then DHASH_RESIZE, then
// pack. scripts/lib/seed-pool.ts runs the same chain; a test proves both give the same bits.

/** 64-character '0'|'1' dHash of an image. Throws when the bytes do not decode as an image. */
export async function dHashOf(bytes: Uint8Array): Promise<string> {
  // removeAlpha is a no-op for JPEG (and so for every seeded image); for a PNG or WebP with
  // transparency it keeps grayscale() at one channel
  const { data, info } = await sharp(bytes).removeAlpha().grayscale().resize(DHASH_RESIZE).raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`dHash expected 1 channel after grayscale, got ${info.channels}`);
  return packDHash(new Uint8Array(data));
}

// ---------------------------------------------------------------------------------------
// Stage 5: EXIF. Never invent a value: what is absent stays absent.

export type ExifFacts = { make?: string; model?: string; dateTimeOriginal?: string; offsetTimeOriginal?: string; width?: number; height?: number };

async function readExif(bytes: Uint8Array): Promise<{ facts: ExifFacts | null; gps: GeoPoint | null }> {
  let tags: Record<string, unknown> | undefined;
  try {
    tags = await exifr.parse(Buffer.from(bytes), { tiff: true, exif: true, gps: true, reviveValues: false });
  } catch {
    tags = undefined; // an unreadable EXIF block is treated as no block, never guessed at
  }
  if (!tags || !Object.keys(tags).length) return { facts: null, gps: null };
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const all: ExifFacts = {
    make: text(tags.Make),
    model: text(tags.Model),
    dateTimeOriginal: text(tags.DateTimeOriginal),
    offsetTimeOriginal: text(tags.OffsetTimeOriginal),
    width: num(tags.ExifImageWidth),
    height: num(tags.ExifImageHeight),
  };
  const facts = Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined)) as ExifFacts;
  const [lat, lon] = [num(tags.latitude), num(tags.longitude)];
  const gps: GeoPoint | null =
    lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { type: "Point", coordinates: [lon, lat] } : null;
  return { facts, gps };
}

const EXIF_TIME = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const EXIF_OFFSET = /^([+-])(\d{2}):(\d{2})$/;
const HOUR = 3_600_000;

/**
 * The window the capture instant must lie in. EXIF time is a wall clock; without an offset
 * tag the zone is unknown, so the window spans every zone (UTC−12 to UTC+14) rather than
 * guessing one. With an offset, the window is the instant itself.
 */
function captureWindow(facts: ExifFacts): { earliest: number; latest: number; instant: Date | null } | null {
  const m = EXIF_TIME.exec(facts.dateTimeOriginal ?? "");
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(wall);
  // rejects "0000:00:00 00:00:00" and rolled-over dates such as month 13
  if (y < 1900 || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return null;
  const o = EXIF_OFFSET.exec(facts.offsetTimeOriginal ?? "");
  if (!o) return { earliest: wall - 14 * HOUR, latest: wall + 12 * HOUR, instant: null };
  const instant = wall - (o[1] === "-" ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3])) * 60_000;
  return { earliest: instant, latest: instant, instant: new Date(instant) };
}

// ---------------------------------------------------------------------------------------
// Stages 2 and 4: duplicate search. Global across tenants, because double-claiming crosses
// them; the disclosure is scoped (§4): a match is named only by an opaque, keyed matchRef.

type Scope = "SAME_PROJECT" | "SAME_ORG" | "OTHER_ORG";
const EXACT: Record<Scope, [Kind, Severity, string]> = {
  SAME_PROJECT: ["EXACT_DUPLICATE_SAME_PROJECT", "LOW", "This exact file was already submitted to this project. Repeat photos of one plot are normal in a time series; check it is not standing in for new work."],
  SAME_ORG: ["EXACT_DUPLICATE_SAME_ORG", "HIGH", "This exact file was already submitted by the same organisation for a different project. One photograph should not support two claims."],
  OTHER_ORG: ["EXACT_DUPLICATE_OTHER_ORG", "HIGH", "This exact file was already submitted by a different organisation. Which one is not disclosed; a platform admin can trace the match."],
};
const PERCEPTUAL: Record<Scope, [Kind, Severity, string]> = {
  SAME_PROJECT: ["PERCEPTUAL_MATCH_SAME_PROJECT", "LOW", "A near-identical photo was already submitted to this project. Expected for a time series of one plot; check it shows new work."],
  SAME_ORG: ["PERCEPTUAL_MATCH_SAME_ORG", "HIGH", "A near-identical photo was already submitted by the same organisation for a different project. It may be one photograph supporting two claims."],
  OTHER_ORG: ["PERCEPTUAL_MATCH_OTHER_ORG", "HIGH", "A near-identical photo was already submitted by a different organisation. Which one is not disclosed; a platform admin can trace the match."],
};

/**
 * Opaque and keyed: without FORENSICS_MATCH_KEY nobody can test a guessed file id against it,
 * not even a verifier who can see files on both sides. A platform admin resolves it by
 * recomputing it over the candidates (Stage 5, with an audit event).
 */
export const matchRef = (fileId: string) =>
  `mr_${createHmac("sha256", requireEnv("FORENSICS_MATCH_KEY")).update(`delta/forensics/matchRef/v1/${fileId}`).digest("hex").slice(0, 32)}`;

/**
 * Only files that existed before this one (created_at, then id): a copy is flagged, not the
 * original it copied, and a replay sees exactly the candidates the first run saw. The other
 * files of the same submission and round are the pair itself, judged by NO_VISIBLE_CHANGE.
 */
const priorTo = (f: FileRow) => sql`
  (f.created_at, f.id) < (select created_at, id from evidence_file where id = ${f.id})
  and not (f.submission_id = ${f.submissionId} and f.round = ${f.round})`;
const scopeOf = (s: SubmissionRow) => sql`
  case when s.project_id = ${s.projectId} then 'SAME_PROJECT' when s.owner_org_id = ${s.ownerOrgId} then 'SAME_ORG' else 'OTHER_ORG' end`;

// The nearest earlier match in each scope, chosen exactly (distance, then age, then id). Not
// through the HNSW index: it is approximate, and an approximate candidate set would make a
// replay disagree with the first run (#12). A scan of the bit(64) column is cheap.
async function exactMatches(x: Executor, s: SubmissionRow, f: FileRow) {
  return x.execute<{ scope: Scope; id: string }>(sql`
    select distinct on (scope) scope, id from (
      select f.id, f.created_at, ${scopeOf(s)} as scope
      from evidence_file f join evidence_submission s on s.id = f.submission_id
      where f.sha256 = ${f.sha256} and ${priorTo(f)}
    ) m order by scope, created_at, id`);
}

async function perceptualMatches(x: Executor, s: SubmissionRow, f: FileRow, dhash: string) {
  return x.execute<{ scope: Scope; id: string; distance: number }>(sql`
    select distinct on (scope) scope, id, distance from (
      select f.id, f.created_at, ${scopeOf(s)} as scope, (f.dhash <~> ${dhash}::bit(64))::int as distance
      from evidence_file f join evidence_submission s on s.id = f.submission_id
      where f.dhash is not null and f.sha256 <> ${f.sha256} and ${priorTo(f)}
        and (f.dhash <~> ${dhash}::bit(64)) < ${PERCEPTUAL_THRESHOLD}
    ) m order by scope, distance, created_at, id`);
}

// ---------------------------------------------------------------------------------------
// One file and one round, as values. Reads only: the run writes them, the replay compares.

type Inspected = { file: FileRow; dhash: string; facts: ExifFacts | null; gps: GeoPoint | null; capturedAt: Date | null; c2pa: C2paReadResult };

/** Stages 1, 3 and 5 from the stored bytes, which are the evidence (never the client's). */
async function inspect(storage: StoragePort, file: FileRow): Promise<Inspected> {
  const stored = await storage.get(file.storageKey);
  // a recorded file with no bytes is evidence loss (THREAT_MODEL T10): fail loudly
  if (!stored) throw new Error(`evidence file ${file.id} has no stored bytes at its storage key`);
  const bytes = new Uint8Array(await new Response(stored.stream).arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error(`evidence file ${file.id} changed in storage since intake`);
  const dhash = await dHashOf(bytes);
  if (file.dhash !== null && file.dhash !== dhash) throw new Error(`evidence file ${file.id}: dHash drifted from the one recorded at intake`);
  const { facts, gps } = await readExif(bytes);
  const c2pa = await readC2pa(bytes, file.mime);
  return { file, dhash, facts, gps, capturedAt: facts ? (captureWindow(facts)?.instant ?? null) : null, c2pa };
}

const finding = (file: FileRow | null, kind: Kind, severity: Severity, reason: string, evidence: Record<string, unknown> = {}): PipelineFinding => ({
  evidenceFileId: file?.id ?? null,
  kind,
  severity,
  reason,
  evidence: { ...evidence, ruleVersion: RULE_VERSION },
  ruleVersion: RULE_VERSION,
});

type ProjectFacts = { createdAt: Date; claimedQuantity: string | null; claimedUnit: string | null; boundaryAreaM2: number };

async function analyse(x: Executor, s: SubmissionRow, project: ProjectFacts, files: Inspected[]): Promise<PipelineFinding[]> {
  const out: PipelineFinding[] = [];
  for (const { file, dhash, facts, gps, c2pa } of files) {
    if (c2pa.outcome !== "absent") {
      const cf = c2paFinding(c2pa);
      out.push({ evidenceFileId: file.id, kind: cf.kind, severity: cf.severity, reason: cf.reason, evidence: cf.evidence, ruleVersion: C2PA_RULE_VERSION });
    }
    for (const m of await exactMatches(x, s, file)) {
      const [kind, severity, reason] = EXACT[m.scope];
      out.push(finding(file, kind, severity, reason, { sha256: file.sha256, matchRef: matchRef(m.id) }));
    }
    for (const m of await perceptualMatches(x, s, file, dhash)) {
      const [kind, severity, reason] = PERCEPTUAL[m.scope];
      out.push(finding(file, kind, severity, reason, { distance: Number(m.distance), threshold: PERCEPTUAL_THRESHOLD, matchRef: matchRef(m.id) }));
    }

    if (!facts) {
      out.push(finding(file, "EXIF_FULLY_STRIPPED", "LOW", "The photo has no EXIF metadata at all, so its camera, capture time and position cannot be checked. Many apps strip it on export; missing metadata is a signal, not guilt."));
    } else {
      const window = captureWindow(facts);
      if (!window) {
        out.push(finding(file, "EXIF_TIMESTAMP_MISSING", "LOW", "The photo has EXIF metadata but no readable capture time (DateTimeOriginal).", { dateTimeOriginal: facts.dateTimeOriginal ?? null }));
      } else {
        const uploadedAt = file.createdAt.getTime();
        // a BEFORE photo predating the project is a baseline, not a red flag; later photos are not
        const tooEarly = file.role !== "BEFORE" && window.latest < project.createdAt.getTime();
        const inFuture = window.earliest > uploadedAt;
        if (tooEarly || inFuture) {
          out.push(
            finding(
              file,
              "EXIF_TIMESTAMP_IMPLAUSIBLE",
              "MEDIUM",
              inFuture ? "The capture time in the photo is later than the moment it was uploaded." : "The capture time in the photo is earlier than the project's creation, for a photo meant to show work on it.",
              {
                dateTimeOriginal: facts.dateTimeOriginal ?? null,
                offsetTimeOriginal: facts.offsetTimeOriginal ?? null,
                projectCreatedAt: project.createdAt.toISOString(),
                uploadedAt: file.createdAt.toISOString(),
              },
            ),
          );
        }
      }
    }

    if (!gps) {
      out.push(finding(file, "GPS_MISSING", "LOW", "The photo carries no GPS position, so where it was taken cannot be checked. Missing metadata is a signal, not guilt."));
    } else {
      const at = await locateAgainstBoundary(x, s.projectId, gps);
      const evidence = { distanceMeters: at.distanceMeters, toleranceMeters: at.toleranceMeters };
      if (at.inside) out.push(finding(file, "GPS_INSIDE_BOUNDARY", "INFO", "The photo's GPS position is inside the project boundary.", evidence));
      else if (at.withinTolerance) out.push(finding(file, "GPS_WITHIN_TOLERANCE", "INFO", `The photo's GPS position is ${at.distanceMeters} m outside the boundary, within the project's ${at.toleranceMeters} m tolerance.`, evidence));
      else out.push(finding(file, "GPS_OUTSIDE_BOUNDARY", "MEDIUM", `The photo's GPS position is ${at.distanceMeters} m outside the project boundary, beyond its ${at.toleranceMeters} m tolerance.`, evidence));
    }
  }

  // Stage 7: the pair. Only a round with both photos has one.
  const before = files.find((f) => f.file.role === "BEFORE");
  const after = files.find((f) => f.file.role === "AFTER");
  if (before && after) {
    const distance = hammingDistance(before.dhash, after.dhash);
    if (distance < NO_CHANGE_THRESHOLD) {
      out.push(finding(after.file, "NO_VISIBLE_CHANGE", "MEDIUM", "The before and after photos are nearly identical; the pair may show the same scene with no change.", { distance, threshold: NO_CHANGE_THRESHOLD }));
    }
  }

  // claims.v1, once per submission: the project's own number against its own boundary
  if (files[0]?.file.round === 1) {
    const claim = claimFinding(checkClaim(project.claimedQuantity === null ? null : Number(project.claimedQuantity), project.claimedUnit, project.boundaryAreaM2));
    if (claim) out.push({ evidenceFileId: null, kind: claim.kind, severity: claim.severity, reason: claim.reason, evidence: claim.evidence, ruleVersion: CLAIMS_RULE_VERSION });
    if (files.every((f) => f.c2pa.outcome === "absent")) {
      const cf = c2paFinding({ outcome: "absent" });
      out.push({ evidenceFileId: null, kind: cf.kind, severity: cf.severity, reason: cf.reason, evidence: cf.evidence, ruleVersion: C2PA_RULE_VERSION });
    }
  }
  return out;
}

const ROLE_ORDER = sql`case ${evidenceFile.role} when 'BEFORE' then 0 when 'AFTER' then 1 else 2 end`;
const roundFiles = (x: Executor, submissionId: string, round: number) =>
  x.select().from(evidenceFile).where(and(eq(evidenceFile.submissionId, submissionId), eq(evidenceFile.round, round))).orderBy(ROLE_ORDER, asc(evidenceFile.id));

async function load(x: Executor, submissionId: string) {
  const [s] = await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, submissionId));
  if (!s) throw new Error(`submission ${submissionId} not found`);
  const [project] = await x
    .select({ createdAt: impactProject.createdAt, claimedQuantity: impactProject.claimedQuantity, claimedUnit: impactProject.claimedUnit })
    .from(impactProject)
    .where(eq(impactProject.id, s.projectId));
  // the spheroid area of the exact boundary, which never leaves the server
  const [area] = await x.execute<{ area: number | null }>(sql`select ST_Area(boundary) as area from project_private_location where project_id = ${s.projectId}`);
  return { s, project: { ...project!, boundaryAreaM2: Number(area?.area ?? 0) } };
}

const GPS_KINDS: Kind[] = ["GPS_MISSING", "GPS_INSIDE_BOUNDARY", "GPS_WITHIN_TOLERANCE", "GPS_OUTSIDE_BOUNDARY"];
const CLAIM_KINDS = new Set<Kind>(["CLAIM_CHECKED", "CLAIM_EXCEEDS_AREA", "CLAIM_DENSITY_IMPLAUSIBLE"]);

// ---------------------------------------------------------------------------------------
// The run, the score cache and the replay.

/**
 * Runs stages 1–7 for one round and writes the result in one transaction: file metadata, the
 * findings, PENDING_FORENSICS → IN_REVIEW, and the score cache. Safe to run twice: every file
 * gets exactly one GPS_* finding per run, so a round that has them is already done.
 */
export async function runForensics(submissionId: string, round: number, x: Executor = db, storage: StoragePort = evidenceStorage): Promise<"done" | "already-done"> {
  const files = await roundFiles(x, submissionId, round);
  if (!files.length) throw new Error(`submission ${submissionId} has no files in round ${round}`);
  const inspected = await Promise.all(files.map((f) => inspect(storage, f)));

  return x.transaction(async (tx) => {
    const [s] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, submissionId)).for("update");
    const ids = files.map((f) => f.id);
    const [seen] = await tx.select({ id: forensicFinding.id }).from(forensicFinding).where(and(inArray(forensicFinding.evidenceFileId, ids), inArray(forensicFinding.kind, GPS_KINDS))).limit(1);
    if (seen) return "already-done";

    const { project } = await load(tx, submissionId);
    for (const i of inspected) {
      await tx.update(evidenceFile).set({ dhash: i.dhash, exif: i.facts, gps: i.gps, capturedAt: i.capturedAt }).where(eq(evidenceFile.id, i.file.id));
    }
    const found = await analyse(tx, s!, project, inspected);
    if (found.length) await tx.insert(forensicFinding).values(found.map((f) => ({ ...f, submissionId })));
    const from = s!.status;
    if (from === "PENDING_FORENSICS") {
      assertTransition(from, "IN_REVIEW");
      await tx.update(evidenceSubmission).set({ status: "IN_REVIEW" }).where(eq(evidenceSubmission.id, submissionId));
    }
    await refreshRiskCache(tx, submissionId);
    // a system event: no person ran the checks
    const bySeverity = Object.fromEntries((["HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) => [sev, found.filter((f) => f.severity === sev).length]));
    await appendAuditEvent(tx, {
      orgId: s!.ownerOrgId,
      eventType: "FORENSICS_COMPLETED",
      actorUserId: null,
      payload: { submissionId, round, ruleVersion: RULE_VERSION, findings: bySeverity, from, status: from === "PENDING_FORENSICS" ? "IN_REVIEW" : from },
    });
    await enqueueJob({ kind: AI_JOB, payload: { submissionId, round }, idempotencyKey: `ai:${submissionId}:${round}` }, tx);
    if (round === 1) await enqueueJob({ kind: NDVI_JOB, payload: { submissionId }, idempotencyKey: `ndvi:${submissionId}` }, tx);
    return "done";
  });
}

/**
 * The only writer of risk_score, risk_band and scoring_version: scoring.v1 over every
 * finding the submission has, stamped with its version (docs/10 §6). Gates nothing.
 */
export async function refreshRiskCache(x: Executor, submissionId: string) {
  const rows = await x.select({ kind: forensicFinding.kind, severity: forensicFinding.severity }).from(forensicFinding).where(eq(forensicFinding.submissionId, submissionId));
  const r = scoreV1(rows);
  await x.update(evidenceSubmission).set({ riskScore: String(r.score), riskBand: r.band, scoringVersion: r.version }).where(eq(evidenceSubmission.id, submissionId));
}

/** JSON with keys sorted at every depth: jsonb reorders keys, so compare canonical forms. */
const canonical = (v: unknown): string =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? `[${v.map(canonical).join(",")}]`
      : `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
          .join(",")}}`;

const lineOf = (f: Omit<PipelineFinding, "ruleVersion"> & { ruleVersion: string }) => canonical([f.evidenceFileId, f.kind, f.severity, f.reason, f.evidence, f.ruleVersion]);

/**
 * Deterministic replay (docs/10 §7, #12): re-reads the stored bytes, re-runs stages 1–7 for
 * every round, and compares with what is stored, finding by finding and file by file.
 * Excludes AI_OBSERVATION and SATELLITE_NDVI (not reproducible: a model, a live archive) and
 * CLIENT_HASH_MISMATCH (written at intake).
 */
export async function replayForensics(submissionId: string, x: Executor = db, storage: StoragePort = evidenceStorage) {
  const { s, project } = await load(x, submissionId);
  const rounds = await x.selectDistinct({ round: evidenceFile.round }).from(evidenceFile).where(eq(evidenceFile.submissionId, submissionId)).orderBy(asc(evidenceFile.round));
  const fresh: PipelineFinding[] = [];
  const actualFiles: string[] = [];
  const storedFiles: string[] = [];
  for (const { round } of rounds) {
    const inspected = await Promise.all((await roundFiles(x, submissionId, round)).map((f) => inspect(storage, f)));
    fresh.push(...(await analyse(x, s, project, inspected)));
    for (const i of inspected) {
      actualFiles.push(canonical([i.file.id, i.dhash, i.facts, i.gps, i.capturedAt?.toISOString() ?? null]));
      storedFiles.push(canonical([i.file.id, i.file.dhash, i.file.exif, i.file.gps, i.file.capturedAt?.toISOString() ?? null]));
    }
  }
  const storedRows = await x
    .select()
    .from(forensicFinding)
    .where(and(eq(forensicFinding.submissionId, submissionId), notInArray(forensicFinding.kind, ["AI_OBSERVATION", "SATELLITE_NDVI", "CLIENT_HASH_MISMATCH"])));
  const stored = storedRows.map((f) => lineOf({ ...f, evidence: f.evidence as Record<string, unknown> }));
  // a record checked before claims.v1 or c2pa.v1 existed has no such finding: it is not re-judged by a rule it never ran
  const claimsRan = storedRows.some((f) => CLAIM_KINDS.has(f.kind));
  const c2paRan = storedRows.some((f) => f.kind === "CONTENT_CREDENTIALS");
  const expected = fresh
    .filter((f) => (claimsRan || !CLAIM_KINDS.has(f.kind)) && (c2paRan || f.kind !== "CONTENT_CREDENTIALS"))
    .map(lineOf);
  const sorted = (a: string[]) => [...a].sort();
  const findingsMatch = canonical(sorted(expected)) === canonical(sorted(stored));
  const filesMatch = canonical(actualFiles) === canonical(storedFiles);
  return { identical: findingsMatch && filesMatch, expected: sorted(expected), stored: sorted(stored), filesMatch };
}

const payload = z.object({ submissionId: z.uuid(), round: z.number().int().min(1) });
registerJobHandler(FORENSICS_JOB, async (raw, { x }) => {
  const p = payload.parse(raw);
  await runForensics(p.submissionId, p.round, x);
});
