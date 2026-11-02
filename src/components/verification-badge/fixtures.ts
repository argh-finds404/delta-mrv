import type { VerificationBadgeProps } from "./verification-badge";

export const verificationBadgeFixtures: Record<string, VerificationBadgeProps> = {
  matchField: {
    state: "MATCH",
    theme: "field",
  },
  matchFieldWithDetail: {
    state: "MATCH",
    detail: "Leaf #41 in Batch 12",
    theme: "field",
  },
  mismatchField: {
    state: "MISMATCH",
    detail: "Hash differs from on-chain root",
    theme: "field",
  },
  pendingField: {
    state: "PENDING",
    detail: "Awaiting next batch anchor",
    theme: "field",
  },
  unavailableField: {
    state: "UNAVAILABLE",
    detail: "RPC node unreachable",
    theme: "field",
  },
  matchPaper: {
    state: "MATCH",
    detail: "Base Sepolia Block 18,241,092",
    theme: "paper",
  },
  mismatchPaper: {
    state: "MISMATCH",
    detail: "Integrity check failed",
    theme: "paper",
  },
  pendingPaper: {
    state: "PENDING",
    theme: "paper",
  },
  unavailablePaper: {
    state: "UNAVAILABLE",
    theme: "paper",
  },
};

