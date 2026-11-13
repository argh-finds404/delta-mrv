// One hue per submission status, shared by badges, the dashboard's status bar and the project
// timeline, so a state reads the same everywhere. Each is at least 4.5:1 as text on
// its own badge tint (11% over white): test/contrast.test.ts.

export type SubmissionStatus = "DRAFT" | "PENDING_FORENSICS" | "IN_REVIEW" | "NEEDS_MORE_PROOF" | "ESCALATED" | "APPROVED" | "ANCHORED" | "REJECTED";

export const STATUS_META: Record<SubmissionStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "#5F6A66" },
  PENDING_FORENSICS: { label: "Being checked", color: "#7650C8" },
  IN_REVIEW: { label: "In review", color: "#2C6BC4" },
  NEEDS_MORE_PROOF: { label: "More proof asked", color: "#9C5D00" },
  ESCALATED: { label: "Escalated", color: "#B44C17" },
  APPROVED: { label: "Approved", color: "#1A7A51" },
  ANCHORED: { label: "Anchored", color: "#4F55C8" },
  REJECTED: { label: "Rejected", color: "#C03D29" },
};

/** The order a submission moves through, for bars and legends. */
export const STATUS_ORDER: SubmissionStatus[] = ["DRAFT", "PENDING_FORENSICS", "IN_REVIEW", "NEEDS_MORE_PROOF", "ESCALATED", "APPROVED", "ANCHORED", "REJECTED"];
