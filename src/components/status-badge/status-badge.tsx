import * as React from "react";
import {
  FileEdit,
  Cpu,
  Eye,
  AlertCircle,
  GitMerge,
  CheckCircle2,
  Link2,
  XCircle,
} from "lucide-react";
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
    icon: React.ComponentType<{ className?: string }>;
    fieldClass: string;
    fieldIconClass: string;
    fieldTextClass: string;
    paperClass: string;
    paperIconClass: string;
    paperTextClass: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    icon: FileEdit,
    fieldClass: "bg-field-raised/50 border-field-hairline",
    fieldIconClass: "text-field-inert",
    fieldTextClass: "text-field-muted",
    paperClass: "bg-paper-card border-paper-rule",
    paperIconClass: "text-paper-muted",
    paperTextClass: "text-paper-muted",
  },
  PENDING_FORENSICS: {
    label: "Pending forensics",
    icon: Cpu,
    fieldClass: "bg-[#E8A33D]/10 border-[#E8A33D]/30",
    fieldIconClass: "text-review",
    fieldTextClass: "text-field-text",
    paperClass: "bg-[#E8A33D]/10 border-[#E8A33D]/30",
    paperIconClass: "text-review",
    paperTextClass: "text-paper-ink",
  },
  IN_REVIEW: {
    label: "In review",
    icon: Eye,
    fieldClass: "bg-[#E8A33D]/10 border-[#E8A33D]/30",
    fieldIconClass: "text-review",
    fieldTextClass: "text-field-text",
    paperClass: "bg-[#E8A33D]/10 border-[#E8A33D]/30",
    paperIconClass: "text-review",
    paperTextClass: "text-paper-ink",
  },
  NEEDS_MORE_PROOF: {
    label: "Needs more proof",
    icon: AlertCircle,
    fieldClass: "bg-[#E8A33D]/10 border-[#E8A33D]/30",
    fieldIconClass: "text-review",
    fieldTextClass: "text-field-text",
    paperClass: "bg-[#E8A33D]/10 border-[#E8A33D]/30",
    paperIconClass: "text-review",
    paperTextClass: "text-paper-ink",
  },
  ESCALATED: {
    label: "Escalated",
    icon: GitMerge,
    fieldClass: "bg-[#E2644F]/10 border-[#E2644F]/40",
    fieldIconClass: "text-fraud",
    fieldTextClass: "text-field-text",
    paperClass: "bg-[#E2644F]/10 border-[#E2644F]/40",
    paperIconClass: "text-fraud",
    paperTextClass: "text-paper-ink",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle2,
    fieldClass: "bg-field-canopy border-verified/40",
    fieldIconClass: "text-verified",
    fieldTextClass: "text-field-text",
    paperClass: "bg-paper-card border-paper-seal/40",
    paperIconClass: "text-paper-seal",
    paperTextClass: "text-paper-ink",
  },
  ANCHORED: {
    label: "Anchored",
    icon: Link2,
    fieldClass: "bg-[#7C8CF8]/10 border-chain/40",
    fieldIconClass: "text-chain",
    fieldTextClass: "text-field-text",
    paperClass: "bg-[#4A4FA8]/10 border-paper-chain/40",
    paperIconClass: "text-paper-chain",
    paperTextClass: "text-paper-ink",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    fieldClass: "bg-[#E2644F]/10 border-fraud/40",
    fieldIconClass: "text-fraud",
    fieldTextClass: "text-field-text",
    paperClass: "bg-[#E2644F]/10 border-[#E2644F]/40",
    paperIconClass: "text-fraud",
    paperTextClass: "text-paper-ink",
  },
};

/**
 * StatusBadge — Submission lifecycle status indicator.
 * Reflects the finite state machine transitions from docs/01-FEATURE-LOCK.md and amendments.
 */
export function StatusBadge({
  status,
  label,
  theme = "field",
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const IconComponent = config.icon;
  const isPaper = theme === "paper";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-normal transition-colors",
        isPaper ? config.paperClass : config.fieldClass,
        className
      )}
    >
      <IconComponent
        className={cn(
          "size-3.5 shrink-0",
          isPaper ? config.paperIconClass : config.fieldIconClass
        )}
      />
      <span
        className={cn(
          "font-normal",
          isPaper ? config.paperTextClass : config.fieldTextClass
        )}
      >
        {label ?? config.label}
      </span>
    </span>
  );
}

