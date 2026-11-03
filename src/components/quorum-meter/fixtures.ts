import type { QuorumMeterProps } from "./quorum-meter";

export const quorumMeterFixtures: Record<string, QuorumMeterProps> = {
  zeroVotes: {
    approvals: 0,
    rejections: 0,
    required: 2,
    theme: "field",
  },
  oneApproval: {
    approvals: 1,
    rejections: 0,
    required: 2,
    theme: "field",
  },
  quorumSatisfied: {
    approvals: 2,
    rejections: 0,
    required: 2,
    theme: "field",
  },
  escalatedSplit: {
    approvals: 1,
    rejections: 1,
    required: 2,
    isEscalated: true,
    theme: "field",
  },
  rejected: {
    approvals: 0,
    rejections: 2,
    required: 2,
    theme: "field",
  },
  paperZeroVotes: {
    approvals: 0,
    rejections: 0,
    required: 2,
    theme: "paper",
  },
  paperQuorumSatisfied: {
    approvals: 2,
    rejections: 0,
    required: 2,
    theme: "paper",
  },
};

