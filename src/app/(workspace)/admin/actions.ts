"use server";

import { requireSession } from "../../../server/auth/session";
import { assignReviewer, lookupMatchRef, resolveMatchRef, retryHaltedJobs, tamperDemo, type MatchLookup, type TamperDemo } from "../../../server/services/admin.service";
import "../../../server/services/job-handlers";
import { drainAfterResponse } from "../../../server/services/jobs.service";
import { anchorNow } from "../../../server/services/anchor.service";
import { ChainUnavailable, DomainError, ForbiddenError } from "../../../server/services/errors";

export type AnchorNowResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * "Anchor now": one anchoring run, as the daily cron makes it. The service decides who may; this
 * only turns what happened into a sentence.
 */
export async function anchorNowAction(): Promise<AnchorNowResult> {
  const session = await requireSession();
  try {
    const run = await anchorNow({ userId: session.user.id });
    const failed = run.batches.filter((b) => b.status === "FAILED");
    const confirmed = run.batches.filter((b) => b.status === "CONFIRMED");
    const sent = run.batches.filter((b) => b.status === "SUBMITTED");
    const records = (n: number) => `${n} ${n === 1 ? "record" : "records"}`;
    const parts: string[] = [];
    if (confirmed.length) parts.push(`${confirmed.map((b) => `Batch ${b.batchId} confirmed on chain with ${records(b.leafCount)}.`).join(" ")}`);
    if (sent.length) parts.push(`${sent.map((b) => `Batch ${b.batchId} was sent and is waiting for confirmation.`).join(" ")}`);
    if (failed.length) parts.push(`${failed.map((b) => `Batch ${b.batchId} was not anchored (${b.error ?? "unknown reason"}); its records stay approved and it will be sent again on the next run.`).join(" ")}`);
    if (run.refused.length) parts.push(`${records(run.refused.length)} refused: the stored record no longer matches its fingerprint.`);
    if (!parts.length) parts.push("Nothing was waiting to be anchored.");
    return { ok: failed.length === 0 && run.refused.length === 0, message: parts.join(" ") };
  } catch (e) {
    if (e instanceof ChainUnavailable) return { ok: false, message: "Anchoring is not configured on this server: the chain endpoint, the contract address and the anchor key are set in its environment." };
    if (e instanceof ForbiddenError) return { ok: false, message: "Only a Delta operator may run anchoring." };
    throw e;
  }
}

/** The tamper demo (DEMO_MODE only): one event changed in a copy of a real chain, and what verification says. */
export async function tamperDemoAction(): Promise<{ ok: true; demo: TamperDemo } | { ok: false; message: string }> {
  const session = await requireSession();
  try {
    return { ok: true, demo: await tamperDemo({ userId: session.user.id }) };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    throw e;
  }
}

/** An operator assigns a verifier organisation to a project. The service refuses a conflict of interest. */
export async function assignReviewerAction(projectId: string, verifierOrgId: string): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  try {
    await assignReviewer({ userId: session.user.id }, projectId, verifierOrgId);
    return { ok: true, message: "Assigned. That organisation's reviewers can now decide on this project." };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Traces a matchRef for an operator. */
export async function lookupMatchAction(ref: string): Promise<{ ok: true; lookup: MatchLookup } | { ok: false; message: string }> {
  const session = await requireSession();
  try {
    return { ok: true, lookup: await lookupMatchRef({ userId: session.user.id }, ref) };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Records an operator's conclusion about a match, with its reason, on the flagged submissions' audit chains. */
export async function resolveMatchAction(ref: string, outcome: "CONFIRMED" | "CLEARED", reason: string): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  try {
    const n = await resolveMatchRef({ userId: session.user.id }, ref, { outcome, reason });
    return { ok: true, message: `Recorded on ${n} ${n === 1 ? "submission" : "submissions"}. Their reviewers see it beside the finding.` };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    throw e;
  }
}

/** "Retry stopped jobs" (M6): they go back in the queue, and the queue is worked once this response is sent. */
export async function retryJobsAction(): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  try {
    const n = await retryHaltedJobs({ userId: session.user.id });
    if (n) drainAfterResponse();
    return { ok: true, message: n ? `${n} ${n === 1 ? "job is" : "jobs are"} back in the queue and being run now.` : "No job had stopped." };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    throw e;
  }
}
