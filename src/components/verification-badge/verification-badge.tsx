import * as React from "react";
import { ShieldCheck, ShieldAlert, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";

export type VerificationState = "MATCH" | "MISMATCH" | "PENDING" | "UNAVAILABLE";

export interface VerificationBadgeProps {
  /** The cryptographic verification result */
  state: VerificationState;
  /** Optional secondary explanatory detail */
  detail?: string;
  /** Theme: field (default) or paper */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

const badgeConfig: Record<
  VerificationState,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    fieldContainerClass: string;
    fieldIconClass: string;
    fieldTextClass: string;
    paperContainerClass: string;
    paperIconClass: string;
    paperTextClass: string;
  }
> = {
  MATCH: {
    label: "Match",
    description: "Recomputed manifest hash is anchored in Merkle tree",
    icon: ShieldCheck,
    // Maintainer override: --verified is border/icon only. Text is --field-text.
    fieldContainerClass: "border-verified/40 bg-field-canopy",
    fieldIconClass: "text-verified",
    fieldTextClass: "text-field-text",
    paperContainerClass: "border-paper-seal/40 bg-paper-card",
    paperIconClass: "text-paper-seal",
    paperTextClass: "text-paper-ink",
  },
  MISMATCH: {
    label: "Mismatch",
    description: "Record differs from anchored cryptographic commitment",
    icon: ShieldAlert,
    fieldContainerClass: "border-fraud/40 bg-[#E2644F]/10",
    fieldIconClass: "text-fraud",
    fieldTextClass: "text-field-text",
    paperContainerClass: "border-[#E2644F]/40 bg-[#E2644F]/10",
    paperIconClass: "text-fraud",
    paperTextClass: "text-paper-ink",
  },
  PENDING: {
    label: "Pending",
    description: "Approved by verifiers; Merkle batch awaiting Base Sepolia confirmation",
    icon: Clock,
    fieldContainerClass: "border-review/40 bg-[#E8A33D]/10",
    fieldIconClass: "text-review",
    fieldTextClass: "text-field-text",
    paperContainerClass: "border-[#E8A33D]/40 bg-[#E8A33D]/10",
    paperIconClass: "text-review",
    paperTextClass: "text-paper-ink",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    description: "Chain RPC unreachable or client offline — neutral grey, never a false mismatch",
    icon: HelpCircle,
    fieldContainerClass: "border-field-hairline bg-field-raised/50",
    fieldIconClass: "text-field-muted",
    fieldTextClass: "text-field-muted",
    paperContainerClass: "border-paper-rule bg-paper-card",
    paperIconClass: "text-paper-muted",
    paperTextClass: "text-paper-muted",
  },
};

/**
 * VerificationBadge — Trust-engine proof dossier indicator.
 * Strictly respects the four cryptographic states: MATCH, MISMATCH, PENDING, UNAVAILABLE.
 * Adheres to WCAG AA text contrast rules: --verified is strictly fill/border/icon, never normal text.
 */
export function VerificationBadge({
  state,
  detail,
  theme = "field",
  className,
}: VerificationBadgeProps) {
  const config = badgeConfig[state];
  const IconComponent = config.icon;
  const isPaper = theme === "paper";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-xs transition-colors",
        isPaper ? config.paperContainerClass : config.fieldContainerClass,
        className
      )}
    >
      <IconComponent
        className={cn(
          "size-4 shrink-0",
          isPaper ? config.paperIconClass : config.fieldIconClass
        )}
      />
      <span
        className={cn(
          "font-medium tracking-normal",
          isPaper ? config.paperTextClass : config.fieldTextClass
        )}
      >
        {config.label}
      </span>
      {detail && (
        <span
          className={cn(
            "font-mono tabular-nums text-[11px] opacity-80",
            isPaper ? "text-paper-muted" : "text-field-muted"
          )}
        >
          · {detail}
        </span>
      )}
    </div>
  );
}

