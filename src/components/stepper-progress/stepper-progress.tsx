import * as React from "react";
import { Check, Loader2, AlertTriangle, X, Circle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus =
  | "queued"
  | "running"
  | "done"
  | "warning"
  | "failed"
  | "skipped";

export interface StepItem {
  id: string;
  label: string;
  status: StepStatus;
  value?: string;
  error?: string;
  isOptional?: boolean;
}

export interface StepperProgressProps {
  /** Title of the pipeline run */
  title?: string;
  /** Ordered list of discrete pipeline stages */
  steps: StepItem[];
  /** Optional measured elapsed time in seconds */
  elapsedSeconds?: number;
  /** Theme: field (default) or paper */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

const statusIconConfig: Record<
  StepStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    fieldColor: string;
    paperColor: string;
  }
> = {
  queued: {
    icon: Circle,
    fieldColor: "text-field-inert",
    paperColor: "text-paper-muted/50",
  },
  running: {
    icon: Loader2,
    fieldColor: "text-signal animate-spin",
    paperColor: "text-paper-seal animate-spin",
  },
  done: {
    icon: Check,
    fieldColor: "text-verified",
    paperColor: "text-paper-seal",
  },
  warning: {
    icon: AlertTriangle,
    fieldColor: "text-review",
    paperColor: "text-[#8F5B10]",
  },
  failed: {
    icon: X,
    fieldColor: "text-fraud",
    paperColor: "text-[#9E2A18]",
  },
  skipped: {
    icon: Minus,
    fieldColor: "text-field-inert",
    paperColor: "text-paper-muted/40",
  },
};

/**
 * StepperProgress — Discrete Forensic Pipeline Stage Tracker.
 * Obeying docs/15-UI-STATES.md §4 honesty rules: No synthetic progress bars.
 * Stages explain what the trust engine is computing while the user waits.
 */
export function StepperProgress({
  title = "Forensics Pipeline Progress",
  steps,
  elapsedSeconds,
  theme = "field",
  className,
}: StepperProgressProps) {
  const isPaper = theme === "paper";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 text-xs font-sans transition-colors",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      {/* Header with Title and Elapsed Time */}
      <div className="flex items-center justify-between border-b pb-2 mb-3 border-inherit">
        <span className="font-medium text-xs">{title}</span>
        {typeof elapsedSeconds === "number" && (
          <span
            className={cn(
              "font-mono tabular-nums text-[11px]",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            {elapsedSeconds.toFixed(1)}s elapsed
          </span>
        )}
      </div>

      {/* Discrete Step Sequence */}
      <div className="space-y-2">
        {steps.map((step) => {
          const config = statusIconConfig[step.status];
          const IconComponent = config.icon;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-sm p-1.5 transition-colors",
                step.status === "running" &&
                  (isPaper ? "bg-paper/70" : "bg-field-raised/60")
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <IconComponent
                  className={cn(
                    "size-4 shrink-0",
                    isPaper ? config.paperColor : config.fieldColor
                  )}
                />
                <span
                  className={cn(
                    "truncate text-xs",
                    step.status === "queued" &&
                      (isPaper ? "text-paper-muted/60" : "text-field-inert"),
                    step.status === "running" && "font-medium text-field-text",
                    step.status === "failed" && "text-fraud font-medium"
                  )}
                >
                  {step.label}
                  {step.isOptional && (
                    <span
                      className={cn(
                        "ml-1.5 font-normal text-[11px]",
                        isPaper ? "text-paper-muted" : "text-field-muted"
                      )}
                    >
                      (optional)
                    </span>
                  )}
                </span>
              </div>

              {/* Monospace telemetry / finding or error callout */}
              <div className="shrink-0 text-right">
                {step.value && (
                  <span
                    className={cn(
                      "font-mono tabular-nums text-[11px]",
                      step.status === "warning"
                        ? "text-review"
                        : isPaper
                        ? "text-paper-muted"
                        : "text-field-muted"
                    )}
                  >
                    {step.value}
                  </span>
                )}
                {step.error && (
                  <span className="font-mono text-[11px] text-fraud block">
                    {step.error}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

