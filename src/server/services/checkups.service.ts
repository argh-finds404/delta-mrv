import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { evidenceFile, evidenceSubmission, impactProject, reviewDecision } from "../db/schema";
import { actorContext, isUuid, type Actor, type Executor } from "./access";
import { ConflictError, NotFoundError } from "./errors";

// Survival check-ups (docs/01-FEATURE-LOCK.md, maintainer addition 2026-11-14): an approved record is
// photographed again from the same spot every `checkup_months`, and each visit is reviewed like any
// submission. This file reads where each record stands. A missed visit is said plainly ("overdue"),
// and an overdue record is never shown as passing: no evidence is not evidence of survival.

type Status = (typeof evidenceSubmission.$inferSelect)["status"];
export type CheckupState = "none" | "scheduled" | "due" | "overdue" | "in-review";

const PUBLIC: Status[] = ["APPROVED", "ANCHORED"];
const IN_REVIEW: Status[] = ["PENDING_FORENSICS", "IN_REVIEW", "NEEDS_MORE_PROOF", "ESCALATED"];
/** A visit becomes "due" this long before the date it is promised for. */
export const DUE_WINDOW_DAYS = 30;
const DAY = 86_400_000;

export type CheckupVisit = { submissionId: string; status: Status; submittedAt: Date; approvedAt: Date | null };
export type SurvivalRecord = {
  /** The original approved record every visit revisits. */
  recordId: string;
  approvedAt: Date;
  /** Its check-ups, oldest first: approved ones always, pending ones only for the owner's view. */
  visits: CheckupVisit[];
  /** The latest approved evidence of this spot: the record or its newest approved visit. */
  lastEvidenceAt: Date;
  nextDueAt: Date | null;
  state: CheckupState;
};
export type ProjectSurvival = { checkupMonths: number | null; records: SurvivalRecord[] };

const addMonths = (d: Date, months: number) => {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
};

/** When a record was approved: the sealed manifest's time, else the last approving vote, else when it was sent. */
async function approvalTimes(x: Executor, ids: string[]): Promise<Map<string, Date>> {
  if (!ids.length) return new Map();
  const rows = await x
    .select({ id: evidenceSubmission.id, sealed: sql<string | null>`${evidenceSubmission.manifest}->>'approvedAtIso'`, submittedAt: evidenceSubmission.submittedAt })
    .from(evidenceSubmission)
    .where(inArray(evidenceSubmission.id, ids));
  const votes = await x
    .select({ id: reviewDecision.submissionId, at: sql<string>`max(${reviewDecision.createdAt})` })
    .from(reviewDecision)
    .where(and(inArray(reviewDecision.submissionId, ids), eq(reviewDecision.decision, "APPROVE")))
    .groupBy(reviewDecision.submissionId);
  const voted = new Map(votes.map((v) => [v.id, new Date(v.at)]));
  return new Map(rows.map((r) => [r.id, r.sealed ? new Date(r.sealed) : (voted.get(r.id) ?? r.submittedAt)]));
}

export function stateOf(months: number | null, lastEvidenceAt: Date, pending: boolean, now = new Date()): { nextDueAt: Date | null; state: CheckupState } {
  if (!months) return { nextDueAt: null, state: "none" };
  const nextDueAt = addMonths(lastEvidenceAt, months);
  if (pending) return { nextDueAt, state: "in-review" };
  if (now.getTime() > nextDueAt.getTime()) return { nextDueAt, state: "overdue" };
  if (now.getTime() > nextDueAt.getTime() - DUE_WINDOW_DAYS * DAY) return { nextDueAt, state: "due" };
  return { nextDueAt, state: "scheduled" };
}

/**
 * Every approved original record of a project with its visits and when the next is due, newest
 * record first (at most `limit`). Public by default: only approved visits count and are listed.
 * With `includePending`, visits still in review are listed and turn the state to "in-review".
 */
export async function projectSurvival(projectId: string, opts: { includePending?: boolean; limit?: number; now?: Date } = {}, x: Executor = db): Promise<ProjectSurvival> {
  if (!isUuid(projectId)) return { checkupMonths: null, records: [] };
  const [project] = await x.select({ months: impactProject.checkupMonths }).from(impactProject).where(eq(impactProject.id, projectId));
  if (!project) return { checkupMonths: null, records: [] };
  const records = await x
    .select({ id: evidenceSubmission.id })
    .from(evidenceSubmission)
    .where(and(eq(evidenceSubmission.projectId, projectId), isNull(evidenceSubmission.followsSubmissionId), inArray(evidenceSubmission.status, PUBLIC)))
    .orderBy(desc(evidenceSubmission.submittedAt))
    .limit(opts.limit ?? 20);
  if (!records.length) return { checkupMonths: project.months, records: [] };
  const visitRows = await x
    .select({ id: evidenceSubmission.id, follows: evidenceSubmission.followsSubmissionId, status: evidenceSubmission.status, submittedAt: evidenceSubmission.submittedAt })
    .from(evidenceSubmission)
    .where(and(inArray(evidenceSubmission.followsSubmissionId, records.map((r) => r.id)), inArray(evidenceSubmission.status, opts.includePending ? [...PUBLIC, ...IN_REVIEW] : PUBLIC)))
    .orderBy(asc(evidenceSubmission.submittedAt));
  const approved = await approvalTimes(x, [...records.map((r) => r.id), ...visitRows.filter((v) => PUBLIC.includes(v.status)).map((v) => v.id)]);

  return {
    checkupMonths: project.months,
    records: records.map(({ id }): SurvivalRecord => {
      const visits = visitRows.filter((v) => v.follows === id).map((v) => ({ submissionId: v.id, status: v.status, submittedAt: v.submittedAt, approvedAt: approved.get(v.id) ?? null }));
      const approvedAt = approved.get(id)!;
      const lastEvidenceAt = [approvedAt, ...visits.map((v) => v.approvedAt).filter((d): d is Date => d !== null)].reduce((a, b) => (b > a ? b : a));
      const pending = visits.some((v) => IN_REVIEW.includes(v.status));
      return { recordId: id, approvedAt, visits, lastEvidenceAt, ...stateOf(project.months, lastEvidenceAt, pending, opts.now) };
    }),
  };
}

export type CheckupDue = { projectId: string; projectTitle: string; recordId: string; nextDueAt: Date; state: "due" | "overdue" };

/** The owner's to-do list: records across the caller's organisations whose next check-up is due or late. */
export async function checkupsDueForOwner(actor: Actor, x: Executor = db): Promise<CheckupDue[]> {
  const ctx = await actorContext(x, actor);
  if (!ctx.orgIds.length) return [];
  const projects = await x
    .select({ id: impactProject.id, title: impactProject.title })
    .from(impactProject)
    .where(and(inArray(impactProject.ownerOrgId, ctx.orgIds), eq(impactProject.status, "ACTIVE"), isNotNull(impactProject.checkupMonths)));
  const out: CheckupDue[] = [];
  for (const p of projects) {
    for (const r of (await projectSurvival(p.id, { includePending: true }, x)).records) {
      if ((r.state === "due" || r.state === "overdue") && r.nextDueAt) out.push({ projectId: p.id, projectTitle: p.title, recordId: r.recordId, nextDueAt: r.nextDueAt, state: r.state });
    }
  }
  return out.sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime());
}

export type CheckupTarget = { recordId: string; projectId: string; approvedAt: Date; referenceFileId: string | null; visits: number };

/**
 * What the submit form needs to start a check-up of `recordId` (or of the record a check-up
 * revisits): the record, its approval time, the photo to frame against and how many approved
 * visits it has. Members of the owning organisation only; anyone else gets one 404.
 */
export async function checkupTarget(actor: Actor, recordId: string, x: Executor = db): Promise<CheckupTarget> {
  if (!isUuid(recordId)) throw new NotFoundError("record not found");
  const [row] = await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, recordId));
  const ctx = await actorContext(x, actor);
  if (!row || !ctx.orgIds.includes(row.ownerOrgId)) throw new NotFoundError("record not found");
  const rootId = row.followsSubmissionId ?? row.id;
  const [root] = rootId === row.id ? [row] : await x.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, rootId));
  if (!root || !PUBLIC.includes(root.status)) throw new ConflictError("Only an approved record can be revisited for a check-up.");
  const [visits] = await x
    .select({ n: sql<number>`count(*)::int` })
    .from(evidenceSubmission)
    .where(and(eq(evidenceSubmission.followsSubmissionId, rootId), inArray(evidenceSubmission.status, PUBLIC)));
  return {
    recordId: rootId,
    projectId: root.projectId,
    approvedAt: (await approvalTimes(x, [rootId])).get(rootId)!,
    referenceFileId: (await referencePhotos(x, [rootId])).get(rootId)?.id ?? null,
    visits: visits?.n ?? 0,
  };
}

/** For a reviewer or the owner: the photo a check-up is compared with, the original record's latest AFTER. */
export async function referencePhotos(x: Executor, recordIds: string[]) {
  if (!recordIds.length) return new Map<string, typeof evidenceFile.$inferSelect>();
  const rows = await x
    .select()
    .from(evidenceFile)
    .where(and(inArray(evidenceFile.submissionId, recordIds), eq(evidenceFile.role, "AFTER")))
    .orderBy(asc(evidenceFile.round), asc(evidenceFile.createdAt));
  return new Map(rows.map((r) => [r.submissionId, r])); // the last write per record wins: its latest AFTER
}
