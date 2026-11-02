import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  /** Label for the single explicit action */
  label: string;
  /** Optional navigation target */
  href?: string;
  /** Optional click handler */
  onClick?: () => void;
}

export interface EmptyStateProps {
  /** Part 1: What this space is for (one sentence, present tense) */
  title: string;
  /** Part 2: Why it is empty right now (specific to actual reason) */
  reason: string;
  /** Part 3: Either one actionable button OR an honest note that nothing can be done */
  action?: EmptyStateAction;
  /** Part 3 alternative: honest statement if no user action exists */
  honestNote?: string;
  /** Optional metadata: timestamp of last check */
  lastChecked?: string;
  /** Optional unfiltered count when empty state is caused by active filters */
  unfilteredCount?: number;
  /** Theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * EmptyState — Three-part pedagogical emptiness surface.
 * Authority: docs/15-UI-STATES.md §2.
 * Rule: Part 1: Purpose. Part 2: Reason. Part 3: Action or honest statement.
 * Prohibitions: No illustrations, no shrugging characters, no "No data found", no exclamation marks.
 */
export function EmptyState({
  title,
  reason,
  action,
  honestNote,
  lastChecked,
  unfilteredCount,
  theme = "field",
  className,
}: EmptyStateProps) {
  const isPaper = theme === "paper";

  return (
    <div
      className={cn(
        "rounded-lg border p-6 text-left transition-colors max-w-xl",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      {/* Part 1: What this space is for */}
      <h3
        className={cn(
          "text-base font-medium tracking-tight mb-1",
          isPaper ? "text-paper-ink font-serif" : "text-field-text"
        )}
      >
        {title}
      </h3>

      {/* Part 2: Why it is empty right now */}
      <p
        className={cn(
          "text-xs leading-relaxed mb-4",
          isPaper ? "text-paper-muted" : "text-field-muted"
        )}
      >
        {reason}
      </p>

      {/* Optional Unfiltered Count Callout */}
      {typeof unfilteredCount === "number" && (
        <div
          className={cn(
            "mb-4 text-xs font-mono tabular-nums rounded px-2.5 py-1.5 border",
            isPaper
              ? "bg-paper border-paper-rule text-paper-muted"
              : "bg-field-raised border-field-hairline text-field-muted"
          )}
        >
          {unfilteredCount} total records exist unfiltered.
        </div>
      )}

      {/* Part 3: One Action OR Honest Statement */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              "inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal",
              isPaper
                ? "bg-paper-seal text-white hover:bg-paper-seal/90"
                : "bg-signal text-[#0C1413] hover:bg-signal/90"
            )}
          >
            <span>{action.label}</span>
            <ArrowRight className="size-3.5" />
          </button>
        )}

        {honestNote && (
          <span
            className={cn(
              "text-xs italic",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            {honestNote}
          </span>
        )}

        {lastChecked && (
          <span
            className={cn(
              "text-[11px] font-mono tabular-nums opacity-80",
              isPaper ? "text-paper-muted" : "text-field-inert"
            )}
          >
            {lastChecked}
          </span>
        )}
      </div>
    </div>
  );
}
