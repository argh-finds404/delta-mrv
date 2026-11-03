import * as React from "react";
import { cn } from "@/src/lib/utils";

export type SubmissionStatus =
  | "DRAFT"
  | "PENDING_FORENSICS"
  | "IN_REVIEW"
  | "NEEDS_MORE_PROOF"
  | "ESCALATED"
  | "APPROVED"
  | "ANCHORED"
  | "REJECTED";

export interface StatusBadgeProps {
  /** The workflow state machine status */
  status: SubmissionStatus;
  /** Custom label override */
  label?: string;
  /** Theme: field (default) or paper */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

const statusConfig: Record<
  SubmissionStatus,
  {
    label: string;
    fieldClass: string;
    paperClass: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--field-muted)_14%,transparent)] border-[color-mix(in_srgb,var(--field-muted)_35%,transparent)] text-field-muted",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-muted)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-muted)_35%,transparent)] text-paper-muted",
  },
  PENDING_FORENSICS: {
    label: "Pending forensics",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review",
    paperClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-[#9A6014]",
  },
  IN_REVIEW: {
    label: "In review",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review",
    paperClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-[#9A6014]",
  },
  NEEDS_MORE_PROOF: {
    label: "Needs more proof",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review",
    paperClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-[#9A6014]",
  },
  ESCALATED: {
    label: "Escalated",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] border-[color-mix(in_srgb,var(--chain)_35%,transparent)] text-chain",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-chain)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-chain)_35%,transparent)] text-paper-chain",
  },
  APPROVED: {
    label: "Approved",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--verified)_14%,transparent)] border-[color-mix(in_srgb,var(--verified)_35%,transparent)] text-verified",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-seal)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-seal)_35%,transparent)] text-paper-seal",
  },
  ANCHORED: {
    label: "Anchored",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] border-[color-mix(in_srgb,var(--chain)_35%,transparent)] text-chain",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-chain)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-chain)_35%,transparent)] text-paper-chain",
  },
  REJECTED: {
    label: "Rejected",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud",
    paperClass:
      "bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud",
  },
};

/**
 * StatusBadge — Submission lifecycle status indicator.
 * Authority: docs/18-VISUAL-CORRECTION.md §1 & §2.
 * Tint rule: 14% tint, 35% border, semantic color as text, and 4px filled dot.
 * Sentence case: never ALL CAPS.
 */
export function StatusBadge({
  status,
  label,
  theme = "field",
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const isPaper = theme === "paper";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-normal tracking-normal transition-colors select-none",
        isPaper ? config.paperClass : config.fieldClass,
        className
      )}
    >
      {/* 4px filled dot in semantic colour */}
      <span className="size-1 rounded-full bg-current shrink-0" aria-hidden="true" />
      <span>{label ?? config.label}</span>
    </span>
  );
}
