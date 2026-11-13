import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { ACTIVITY_LABEL } from "../../lib/format";
import { PROMPT_VERSION, geminiAi } from "../ai/gemini";
import { AiRateLimited, type AiPort } from "../ai/port";
import { db } from "../db/client";
import { evidenceFile, evidenceSubmission, forensicFinding, impactProject } from "../db/schema";
import { evidenceStorage } from "../storage";
import type { StoragePort } from "../storage/port";
import type { Executor } from "./access";
import { AI_JOB, refreshRiskCache } from "./forensics.service";
import { registerJobHandler } from "./jobs.service";

// The advisory observation (docs/08-AI.md). It runs after every deterministic finding exists,
// adds at most one AI_OBSERVATION finding (INFO, or LOW when it asks for a human's attention),
// and can never change a status, approve, reject or score anything: it writes the one finding
// row and refreshes the score cache, in which an AI finding weighs a quarter (scoring.v1).

const RULE_VERSION = "ai.v1";
const MAX_SIDE = 768;

/** docs/08 §5, exactly. Unknown keys are dropped; any violation discards the whole answer. */
export const AiObservation = z.object({
  consistentWithActivity: z.enum(["appears_consistent", "unclear", "appears_inconsistent"]),
  visibleChangeBetweenImages: z.enum(["clear", "subtle", "none", "indeterminate"]),
  observations: z.array(z.string().max(300)).max(5),
  concerns: z.array(z.string().max(300)).max(5),
  recommendsHumanAttention: z.boolean(),
});
type Observation = z.infer<typeof AiObservation>;

export type AiOutcome = "observed" | "already-observed" | "ai_unavailable";

const CONSISTENT = { appears_consistent: "appears consistent with", unclear: "is unclear against", appears_inconsistent: "appears inconsistent with" } as const;
const CHANGE = { clear: "a clear visible change", subtle: "a subtle change", none: "no visible change", indeterminate: "a change that cannot be judged" } as const;

/** The reason a reviewer reads, composed from the validated enums only: no model prose in it. */
const reasonOf = (o: Observation, activity: string) =>
  `Advisory, not evidence: a language model's opinion is that the imagery ${CONSISTENT[o.consistentWithActivity]} ${activity.toLowerCase()}, with ${CHANGE[o.visibleChangeBetweenImages]} between the photos${o.recommendsHumanAttention ? ", and it suggests a closer human look" : ""}.`;

async function downscaled(storage: StoragePort, key: string): Promise<Buffer> {
  const stored = await storage.get(key);
  if (!stored) throw new Error(`evidence at ${key} has no stored bytes`);
  const bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
  // the original never leaves at full resolution (docs/08 §10)
  return sharp(bytes).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
}

/**
 * One observation per submission round. Absent key, timeout, model error or an answer that
 * fails the schema: `ai_unavailable`, a neutral outcome that writes nothing. A rate limit is
 * thrown, so the job runner retries it later with backoff.
 */
export async function runAiAudit(
  submissionId: string,
  round: number,
  x: Executor = db,
  storage: StoragePort = evidenceStorage,
  ai: () => AiPort = geminiAi,
): Promise<AiOutcome> {
  const [s] = await x
    .select({ id: evidenceSubmission.id, activityType: impactProject.activityType })
    .from(evidenceSubmission)
    .innerJoin(impactProject, eq(impactProject.id, evidenceSubmission.projectId))
    .where(eq(evidenceSubmission.id, submissionId));
  if (!s) throw new Error(`submission ${submissionId} not found`);
  const files = await x.select().from(evidenceFile).where(eq(evidenceFile.submissionId, submissionId));
  // the round's after (or supplement) photo, against the original before
  const before = files.find((f) => f.role === "BEFORE");
  const after = round === 1 ? files.find((f) => f.role === "AFTER" && f.round === 1) : files.find((f) => f.round === round);
  if (!before || !after) return "ai_unavailable";

  const [seen] = await x
    .select({ id: forensicFinding.id })
    .from(forensicFinding)
    .where(and(eq(forensicFinding.submissionId, submissionId), eq(forensicFinding.kind, "AI_OBSERVATION"), inArray(forensicFinding.evidenceFileId, [after.id])))
    .limit(1);
  if (seen) return "already-observed";

  let port: AiPort;
  try {
    port = ai();
  } catch {
    return "ai_unavailable"; // no GEMINI_API_KEY or GEMINI_MODEL: neutral, not an error
  }
  const activity = ACTIVITY_LABEL[s.activityType];
  const started = Date.now();
  let observation: Observation;
  try {
    const raw = await port.observe({
      activity,
      images: [
        { label: "before", jpeg: await downscaled(storage, before.storageKey) },
        { label: "after", jpeg: await downscaled(storage, after.storageKey) },
      ],
    });
    const parsed = AiObservation.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn(`ai.audit ${submissionId}: answer failed the schema, discarded`);
      return "ai_unavailable";
    }
    observation = parsed.data;
  } catch (e) {
    if (e instanceof AiRateLimited) throw e;
    console.warn(`ai.audit ${submissionId}: ${e instanceof Error ? e.message : "model call failed"}`);
    return "ai_unavailable";
  }

  await x.transaction(async (tx) => {
    await tx.insert(forensicFinding).values({
      submissionId,
      evidenceFileId: after.id,
      kind: "AI_OBSERVATION",
      severity: observation.recommendsHumanAttention ? "LOW" : "INFO",
      reason: reasonOf(observation, activity),
      evidence: { model: port.model, promptVersion: PROMPT_VERSION, raw: observation, latencyMs: Date.now() - started },
      ruleVersion: RULE_VERSION,
    });
    await refreshRiskCache(tx, submissionId);
  });
  return "observed";
}

const payload = z.object({ submissionId: z.uuid(), round: z.number().int().min(1) });
registerJobHandler(AI_JOB, async (raw, { x }) => {
  const p = payload.parse(raw);
  await runAiAudit(p.submissionId, p.round, x);
});
