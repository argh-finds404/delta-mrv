import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  incrementsRound,
  InvalidTransitionError,
  isTerminal,
  SUBMISSION_STATUSES,
  type SubmissionStatus,
} from "../src/lib/state-machine";
import { submissionStatus } from "../src/server/db/schema";

// The diagram in docs/01-FEATURE-LOCK.md §State machine, written out edge by edge.
// Deliberately NOT derived from the table under test.
const LEGAL: [SubmissionStatus, SubmissionStatus][] = [
  ["DRAFT", "PENDING_FORENSICS"],
  ["PENDING_FORENSICS", "IN_REVIEW"],
  ["IN_REVIEW", "APPROVED"],
  ["IN_REVIEW", "REJECTED"],
  ["IN_REVIEW", "ESCALATED"],
  ["IN_REVIEW", "NEEDS_MORE_PROOF"],
  ["ESCALATED", "APPROVED"],
  ["ESCALATED", "REJECTED"],
  ["NEEDS_MORE_PROOF", "IN_REVIEW"],
  ["APPROVED", "ANCHORED"],
];
const legal = new Set(LEGAL.map(([a, b]) => `${a}>${b}`));

const PAIRS = SUBMISSION_STATUSES.flatMap((from) => SUBMISSION_STATUSES.map((to) => [from, to] as const));

describe("state machine", () => {
  it("knows exactly the statuses the database enum knows", () => {
    expect([...SUBMISSION_STATUSES].sort()).toEqual([...submissionStatus.enumValues].sort());
    expect(SUBMISSION_STATUSES).toHaveLength(8); // there is no SUBMITTED state
  });

  it("covers every ordered pair: 8 x 8 = 64", () => {
    expect(PAIRS).toHaveLength(64);
    expect(LEGAL).toHaveLength(10);
  });

  it.each(PAIRS)("%s -> %s", (from, to) => {
    const expected = legal.has(`${from}>${to}`);
    expect(canTransition(from, to)).toBe(expected);
    if (expected) {
      expect(() => assertTransition(from, to)).not.toThrow();
    } else {
      expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
    }
  });

  it("REJECTED and ANCHORED are terminal; nothing else is", () => {
    for (const s of SUBMISSION_STATUSES) {
      expect(isTerminal(s)).toBe(s === "REJECTED" || s === "ANCHORED");
    }
  });

  it("only NEEDS_MORE_PROOF -> IN_REVIEW starts a new round", () => {
    for (const [from, to] of PAIRS) {
      expect(incrementsRound(from, to)).toBe(from === "NEEDS_MORE_PROOF" && to === "IN_REVIEW");
    }
  });

  it("an escalated submission cannot ask for more proof or go back to review", () => {
    expect(canTransition("ESCALATED", "NEEDS_MORE_PROOF")).toBe(false);
    expect(canTransition("ESCALATED", "IN_REVIEW")).toBe(false);
  });

  it("the error says which transition was refused", () => {
    expect(() => assertTransition("REJECTED", "APPROVED")).toThrow(/REJECTED.*APPROVED/);
  });
});
