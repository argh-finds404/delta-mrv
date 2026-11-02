import type { StatusBadgeProps } from "./status-badge";

export const statusBadgeFixtures: Record<string, StatusBadgeProps> = {
  draft: {
    status: "DRAFT",
    theme: "field",
  },
  pendingForensics: {
    status: "PENDING_FORENSICS",
    theme: "field",
  },
  inReview: {
    status: "IN_REVIEW",
    theme: "field",
  },
  needsMoreProof: {
    status: "NEEDS_MORE_PROOF",
    theme: "field",
  },
  escalated: {
    status: "ESCALATED",
    theme: "field",
  },
  approved: {
    status: "APPROVED",
    theme: "field",
  },
  anchored: {
    status: "ANCHORED",
    theme: "field",
  },
  rejected: {
    status: "REJECTED",
    theme: "field",
  },
  paperApproved: {
    status: "APPROVED",
    theme: "paper",
  },
  paperAnchored: {
    status: "ANCHORED",
    theme: "paper",
  },
  paperEscalated: {
    status: "ESCALATED",
    theme: "paper",
  },
};

