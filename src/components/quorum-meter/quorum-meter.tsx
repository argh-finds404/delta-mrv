import * as React from "react";
import { Check, X, GitMerge, AlertCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface QuorumMeterProps {
  /** Number of approvals recorded in current review round */
  approvals: number;
  /** Number of rejections recorded in current review round */
  rejections: number;
  /** Quorum threshold required (default: 2 per docs/01-FEATURE-LOCK.md) */
  required?: number;
  /** Whether the review is currently in an escalated split decision state (Amendment A1) */
  isEscalated?: boolean;
  /** Theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * QuorumMeter — Independent review consensus indicator.
 * Displays approval/rejection progress using anonymous pips.
 * Rule: Count only — never who voted (docs/17-AGENT-LANES.md §4).
 */
export function QuorumMeter({
  approvals,
  rejections,
  required = 2,
  isEscalated = false,
  theme = "field",
  className,
}: QuorumMeterProps) {
  const isPaper = theme === "paper";

  // State derivation
  const isApproved = approvals >= required;
  const isRejected = rejections >= required;
  const isSplit = isEscalated || (approvals === 1 && rejections === 1);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-xs transition-colors",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2 mb-3 border-inherit">
        <span className="font-sans font-medium text-xs">Review Quorum</span>
        <span
          className={cn(
            "font-mono tabular-nums text-[11px]",
            isPaper ? "text-paper-muted" : "text-field-muted"
          )}
        >
          {approvals} of {required} approvals required
        </span>
      </div>

      {/* Discrete Pips Track */}
      <div className="space-y-2">
        {/* Approvals Track */}
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "text-xs flex items-center gap-1.5",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            <Check className="size-3.5 text-verified" />
            <span>Approvals</span>
          </span>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: required }).map((_, index) => {
              const isFilled = index < approvals;
              return (
                <div
                  key={index}
                  title={isFilled ? `Approval pip ${index + 1}` : "Pending approval"}
                  className={cn(
                    "size-5 rounded-xs flex items-center justify-center font-mono text-[10px] tabular-nums border transition-colors",
                    isFilled
                      ? "bg-verified text-[#0C1413] font-bold border-verified"
                      : isPaper
                      ? "bg-paper border-paper-rule text-paper-muted/40"
                      : "bg-field-abyss border-field-hairline text-field-inert/40"
                  )}
                >
                  {isFilled ? "✓" : index + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rejections Track (if any votes or rejected) */}
        {(rejections > 0 || isRejected) && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span
              className={cn(
                "text-xs flex items-center gap-1.5",
                isPaper ? "text-paper-muted" : "text-field-muted"
              )}
            >
              <X className="size-3.5 text-fraud" />
              <span>Rejections</span>
            </span>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: required }).map((_, index) => {
                const isFilled = index < rejections;
                return (
                  <div
                    key={index}
                    title={isFilled ? `Rejection pip ${index + 1}` : "Empty pip"}
                    className={cn(
                      "size-5 rounded-xs flex items-center justify-center font-mono text-[10px] tabular-nums border transition-colors",
                      isFilled
                        ? "bg-[#E2644F] text-white font-bold border-[#E2644F]"
                        : isPaper
                        ? "bg-paper border-paper-rule text-paper-muted/40"
                        : "bg-field-abyss border-field-hairline text-field-inert/40"
                    )}
                  >
                    {isFilled ? "✕" : index + 1}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Explanatory Context Footer */}
      <div className="mt-3 border-t pt-2 border-inherit text-[11px]">
        {isApproved && (
          <div className="flex items-center gap-1.5 text-verified">
            <Check className="size-3.5" />
            <span>Quorum satisfied (2 independent approvals recorded)</span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-1.5 text-fraud font-medium">
            <X className="size-3.5" />
            <span>Submission rejected (2 independent rejections recorded)</span>
          </div>
        )}

        {isSplit && (
          <div className="flex items-center gap-1.5 text-review">
            <GitMerge className="size-3.5 shrink-0" />
            <span>
              Split decision (1/1) — awaiting deciding vote from a verifier-org
              administrator
            </span>
          </div>
        )}

        {!isApproved && !isRejected && !isSplit && (
          <div
            className={cn(
              "flex items-center gap-1.5",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            <AlertCircle className="size-3.5 shrink-0" />
            <span>
              {approvals === 0
                ? "Awaiting review by 2 distinct verifier users"
                : `1 of ${required} approvals recorded; 1 more required`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

