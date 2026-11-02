import * as React from "react";
import { Info, Minus, AlertTriangle, ShieldAlert } from "lucide-react";
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
    icon: React.ComponentType<{ className?: string }>;
    fieldClass: string;
    paperClass: string;
  }
> = {
  info: {
    defaultLabel: "Info",
    icon: Info,
    fieldClass: "bg-field-raised text-field-muted border-field-hairline",
    paperClass: "bg-paper-card text-paper-muted border-paper-rule",
  },
  low: {
    defaultLabel: "Low",
    icon: Minus,
    fieldClass: "bg-field-raised/60 text-field-inert border-field-hairline",
    paperClass: "bg-paper-card text-paper-muted/80 border-paper-rule",
  },
  medium: {
    defaultLabel: "Medium",
    icon: AlertTriangle,
    fieldClass: "bg-[#E8A33D]/10 text-review border-[#E8A33D]/30",
    paperClass: "bg-[#E8A33D]/15 text-[#8F5B10] border-[#E8A33D]/40",
  },
  high: {
    defaultLabel: "High",
    icon: ShieldAlert,
    fieldClass: "bg-[#E2644F]/10 text-fraud border-[#E2644F]/30",
    paperClass: "bg-[#E2644F]/15 text-[#9E2A18] border-[#E2644F]/40",
  },
};

/**
 * SeverityChip — Visual classification for forensic findings and risk tiers.
 * Enforces shape + label + color encoding (never color alone per WCAG AA).
 */
export function SeverityChip({
  severity,
  count,
  label,
  theme = "field",
  className,
}: SeverityChipProps) {
  const config = severityConfig[severity];
  const IconComponent = config.icon;
  const isPaper = theme === "paper";

  const displayText = label ?? config.defaultLabel;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-normal tracking-normal transition-colors",
        isPaper ? config.paperClass : config.fieldClass,
        className
      )}
    >
      <IconComponent className="size-3.5 shrink-0" />
      <span className="capitalize">{displayText}</span>
      {typeof count === "number" && (
        <span className="font-mono tabular-nums text-[11px] opacity-80">
          ({count})
        </span>
      )}
    </span>
  );
}

