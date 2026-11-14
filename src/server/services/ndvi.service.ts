import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../../env";
import { ACTIVITY_LABEL } from "../../lib/format";
import { db } from "../db/client";
import { evidenceFile, evidenceSubmission, forensicFinding, impactProject } from "../db/schema";
import { crossCheckNdvi, MIN_DAYS_APART, WINDOW_DAYS, type NdviRequest, type NdviResult } from "../satellite/earth-search";
import type { Executor } from "./access";
import { NDVI_JOB, refreshRiskCache } from "./forensics.service";
import { registerJobHandler } from "./jobs.service";
import { siteRingForChecks } from "./projects.service";

// X1 (docs/01-FEATURE-LOCK.md): a free Sentinel-2 vegetation cross-check, run once per
// submission after the deterministic checks. Advisory like the AI pass, but weaker still: one
// INFO finding, which weighs nothing in scoring.v1, changes no status and gates nothing. With the
// flag off, or whenever the archive cannot give a clean comparison, the finding says
// "inconclusive" and why. Not part of replay: it reads a live archive.

const RULE_VERSION = "ndvi.v1";

export type NdviOutcome = "measured" | "inconclusive" | "already-checked";

const day = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const two = (n: number) => n.toFixed(2);

function reasonOf(r: NdviResult): string {
  if (r.outcome === "inconclusive") return `Satellite cross-check inconclusive: ${r.reason}. Advisory only; it weighs nothing in a decision.`;
  const way = r.delta >= 0 ? "a rise" : "a fall";
  return (
    `Advisory, not evidence: the Sentinel-2 vegetation index (NDVI) over the site was ${two(r.baseline.ndvi)} on ${day(r.baseline.datetime)} ` +
    `and ${two(r.current.ndvi)} on ${day(r.current.datetime)}, ${way} of ${two(Math.abs(r.delta))}. Seasons, tides and floods move this number too, ` +
    `and a 20 m pixel shows no single plant.`
  );
}

/** The run, with its parts injectable: the flag and the archive call. */
export async function runNdviCheck(
  submissionId: string,
  x: Executor = db,
  opts: { enabled?: boolean; check?: (req: NdviRequest) => Promise<NdviResult> } = {},
): Promise<NdviOutcome> {
  const { enabled = env.NDVI_ENABLED === "true", check = crossCheckNdvi } = opts;
  const [row] = await x
    .select({ s: evidenceSubmission, activityType: impactProject.activityType, fuzzed: impactProject.fuzzedCentroid, projectCreatedAt: impactProject.createdAt })
    .from(evidenceSubmission)
    .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
    .where(eq(evidenceSubmission.id, submissionId));
  if (!row) throw new Error(`submission ${submissionId} not found`);
  const [seen] = await x
    .select({ id: forensicFinding.id })
    .from(forensicFinding)
    .where(and(eq(forensicFinding.submissionId, submissionId), eq(forensicFinding.kind, "SATELLITE_NDVI")))
    .limit(1);
  if (seen) return "already-checked";

  // the photos' own capture times when they state them, else when the project and the submission began
  const files = await x.select({ role: evidenceFile.role, capturedAt: evidenceFile.capturedAt }).from(evidenceFile).where(and(eq(evidenceFile.submissionId, submissionId), eq(evidenceFile.round, 1)));
  const baselineEnd = files.find((f) => f.role === "BEFORE")?.capturedAt ?? row.projectCreatedAt;
  const currentEnd = files.find((f) => f.role === "AFTER")?.capturedAt ?? row.s.submittedAt;

  const inconclusive = (reason: string): NdviResult => ({ outcome: "inconclusive", reason, telemetry: { endpoint: "", searched: [], scenes: [], bytesRead: 0, elapsedMs: 0 } });
  let result: NdviResult;
  if (!enabled) result = inconclusive("the satellite cross-check is not enabled on this server (NDVI_ENABLED)");
  else if (row.activityType === "RIVER_CLEANUP") result = inconclusive(`a vegetation index does not measure a ${ACTIVITY_LABEL.RIVER_CLEANUP.toLowerCase()}`);
  else if (!row.fuzzed) result = inconclusive("the project has no public location to search the archive with");
  else result = await check({ searchPoint: row.fuzzed.coordinates, ring: await siteRingForChecks(x, row.s.projectId), baselineEnd, currentEnd });

  await x.transaction(async (tx) => {
    await tx.insert(forensicFinding).values({
      submissionId,
      evidenceFileId: null,
      kind: "SATELLITE_NDVI",
      severity: "INFO",
      reason: reasonOf(result),
      evidence: {
        outcome: result.outcome,
        ...(result.outcome === "measured" ? { baseline: result.baseline, current: result.current, delta: result.delta } : { reason: result.reason }),
        baselineEnd: baselineEnd.toISOString(),
        currentEnd: currentEnd.toISOString(),
        windowDays: WINDOW_DAYS,
        minDaysApart: MIN_DAYS_APART,
        telemetry: result.telemetry,
        ruleVersion: RULE_VERSION,
      },
      ruleVersion: RULE_VERSION,
    });
    await refreshRiskCache(tx, submissionId);
  });
  return result.outcome;
}

const payload = z.object({ submissionId: z.uuid() });
registerJobHandler(NDVI_JOB, async (raw, { x }) => {
  await runNdviCheck(payload.parse(raw).submissionId, x);
});
