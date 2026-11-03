import * as React from "react";
import { cn } from "@/src/lib/utils";

export type SeverityLevel = "info" | "low" | "medium" | "high";

export interface SeverityChipProps {
  /** Severity rating of the finding */
  severity: SeverityLevel;
  /** Optional aggregate count */
  count?: number;
  /** Custom label override (defaults to sentence-case severity name) */
  label?: string;
  /** Theme: field (default) or paper */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

const severityConfig: Record<
  SeverityLevel,
  {
    defaultLabel: string;
    fieldClass: string;
    paperClass: string;
  }
> = {
  info: {
    defaultLabel: "Info",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--field-muted)_14%,transparent)] border-[color-mix(in_srgb,var(--field-muted)_35%,transparent)] text-field-muted",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-muted)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-muted)_35%,transparent)] text-paper-muted",
  },
  low: {
    defaultLabel: "Low",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--field-inert)_14%,transparent)] border-[color-mix(in_srgb,var(--field-inert)_35%,transparent)] text-field-muted",
    paperClass:
      "bg-[color-mix(in_srgb,var(--paper-muted)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-muted)_35%,transparent)] text-paper-muted",
  },
  medium: {
    defaultLabel: "Medium",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review",
    paperClass:
      "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-[#9A6014]",
  },
  high: {
    defaultLabel: "High",
    fieldClass:
      "bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud",
    paperClass:
      "bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud",
  },
};

/**
 * SeverityChip — Visual classification for forensic findings and risk tiers.
 * Authority: docs/18-VISUAL-CORRECTION.md §1.
 * Tint rule: 14% tint, 35% border, semantic color as text, and 4px filled dot.
 * Sentence case: never ALL CAPS.
 */
export function SeverityChip({
  severity,
  count,
  label,
  theme = "field",
  className,
}: SeverityChipProps) {
  const config = severityConfig[severity];
  const isPaper = theme === "paper";
  const displayText = label ?? config.defaultLabel;

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
      <span>{displayText}</span>
      {typeof count === "number" && (
        <span className="font-mono tabular-nums text-[11px] opacity-80">
          ({count})
        </span>
      )}
    </span>
  );
}
