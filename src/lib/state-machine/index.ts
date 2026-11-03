// The submission state machine of docs/01-FEATURE-LOCK.md §State machine.
// Pure and isomorphic. Services call assertTransition before every status write.

export const SUBMISSION_STATUSES = [
  "DRAFT",
  "PENDING_FORENSICS",
  "IN_REVIEW",
  "NEEDS_MORE_PROOF",
  "ESCALATED",
  "APPROVED",
  "REJECTED",
  "ANCHORED",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const TRANSITIONS: Readonly<Record<SubmissionStatus, readonly SubmissionStatus[]>> = {
  DRAFT: ["PENDING_FORENSICS"], //                    submissions.finalize
  PENDING_FORENSICS: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED", "ESCALATED", "NEEDS_MORE_PROOF"],
  NEEDS_MORE_PROOF: ["IN_REVIEW"], //                 round + 1
  ESCALATED: ["APPROVED", "REJECTED"], //             deciding vote only
  APPROVED: ["ANCHORED"], //                          after the chain confirms
  REJECTED: [],
  ANCHORED: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: SubmissionStatus,
    readonly to: SubmissionStatus,
  ) {
    super(`invalid submission transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SubmissionStatus, to: SubmissionStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(status: SubmissionStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Quorum is evaluated over the current round only; a new proof round starts a new one. */
export function incrementsRound(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return from === "NEEDS_MORE_PROOF" && to === "IN_REVIEW";
}
