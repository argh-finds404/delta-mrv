import * as React from "react";
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
    fieldClass: string;
    paperClass: string;
  }
> = {
  MATCH: {
    label: "Match",
    description: "Recomputed manifest hash is anchored in Merkle tree",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--verified)_14%,transparent)] border-[color-mix(in_srgb,var(--verified)_35%,transparent)] text-verified",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-seal)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-seal)_35%,transparent)] text-paper-seal",
  },
  MISMATCH: {
    label: "Mismatch",
    description: "Record differs from anchored cryptographic commitment",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud",
    paperClass:
      "bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud",
  },
  PENDING: {
    label: "Pending",
    description: "Approved by verifiers; Merkle batch awaiting Base Sepolia confirmation",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review",
    paperClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    description: "Chain RPC unreachable or client offline — neutral grey, never a false mismatch",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--field-muted)_14%,transparent)] border-[color-mix(in_srgb,var(--field-muted)_35%,transparent)] text-field-muted",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-muted)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-muted)_35%,transparent)] text-paper-muted",
  },
};

/**
 * VerificationBadge — Trust-engine proof dossier indicator.
 * Authority: docs/18-VISUAL-CORRECTION.md §1 & §2.
 * Tint rule: 14% tint, 35% border, semantic color as text, and 4px filled dot.
 * Sentence case: never ALL CAPS.
 */
export function VerificationBadge({
  state,
  detail,
  theme = "field",
  className,
}: VerificationBadgeProps) {
  const config = badgeConfig[state];
  const isPaper = theme === "paper";

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <span
        title={config.description}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-normal tracking-normal transition-colors select-none",
          isPaper ? config.paperClass : config.fieldClass
        )}
      >
        {/* 4px filled dot in semantic colour */}
        <span className="size-1 rounded-full bg-current shrink-0" aria-hidden="true" />
        <span>{config.label}</span>
      </span>

      {detail && (
        <span
          className={cn(
            "text-[11px] leading-tight font-normal",
            isPaper ? "text-paper-muted" : "text-field-muted"
          )}
        >
          {detail}
        </span>
      )}
    </div>
  );
}
