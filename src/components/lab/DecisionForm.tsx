"use client";

import * as React from "react";
import {
  Check,
  X,
  HelpCircle,
  RotateCcw,
  Clock,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

export type DecisionAction = "APPROVE" | "REJECT" | "REQUEST_MORE_PROOF";

export const STRUCTURED_REASONS = [
  {
    code: "EXIF_STRIPPED",
    label: "EXIF Stripped",
    detail: "Camera original photograph required with intact GPS telemetry and capture timestamp.",
  },
  {
    code: "BOUNDARY_MARKER_NOT_VISIBLE",
    label: "Boundary Unclear",
    detail: "Ground corner stake or registered perimeter marker not discernible in frame.",
  },
  {
    code: "BLURRY_AFTER_PHOTO",
    label: "Low Resolution",
    detail: "After-work photographic resolution insufficient to verify sapling count or survival.",
  },
  {
    code: "SUSPECTED_CROSS_PLOT_OVERLAP",
    label: "Cross-Plot Overlap",
    detail: "Vantage perspective overlaps with adjacent sector; provide distinct heading angle.",
  },
] as const;

export interface DecisionPayload {
  action: DecisionAction;
  reason: string;
}

export interface DecisionFormProps {
  /** Submission identifier */
  submissionId: string;
  /** Approvals recorded in current round */
  approvalsCount: number;
  /** Rejections recorded in current round */
  rejectionsCount: number;
  /** Required approvals quorum (default: 2) */
  requiredQuorum?: number;
  /** Whether the submission is in an escalated split-decision state */
  isEscalated?: boolean;
  /** Whether the active user has already submitted a decision */
  userHasDecided?: boolean;
  /** The prior decision if user has already decided */
  userDecision?: DecisionAction;
  /** Callback fired when a decision is confirmed */
  onSubmitDecision?: (payload: DecisionPayload) => void;
  /** Callback fired if decision is undone in grace window */
  onUndoDecision?: () => void;
  /** Optional theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

// Literal class names, so Tailwind can see them. A semantic colour is a 14% tint, never a fill.
const TINT = {
  chain: "border-[color-mix(in_srgb,var(--chain)_35%,transparent)] bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] text-chain",
  verified: "border-[color-mix(in_srgb,var(--verified)_35%,transparent)] bg-[color-mix(in_srgb,var(--verified)_14%,transparent)] text-verified",
  fraud: "border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] text-fraud",
  review: "border-[color-mix(in_srgb,var(--review)_35%,transparent)] bg-[color-mix(in_srgb,var(--review)_14%,transparent)] text-review",
} as const;

export function DecisionForm({
  submissionId,
  approvalsCount,
  rejectionsCount,
  requiredQuorum = 2,
  isEscalated = false,
  userHasDecided = false,
  userDecision,
  onSubmitDecision,
  onUndoDecision,
  theme = "field",
  className,
}: DecisionFormProps) {
  const isPaper = theme === "paper";

  const [reason, setReason] = React.useState<string>("");
  const [pendingDecision, setPendingDecision] = React.useState<DecisionAction | null>(null);
  const [undoCountdown, setUndoCountdown] = React.useState<number>(5);

  const isSplit = isEscalated || (approvalsCount === 1 && rejectionsCount === 1);
  const reasonLength = reason.trim().length;
  const isReasonValid = reasonLength >= 20;

  // Handle transient undo countdown asynchronously via timer
  React.useEffect(() => {
    if (!pendingDecision) return;

    const timer = setInterval(() => {
      setUndoCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onSubmitDecision) {
            onSubmitDecision({ action: pendingDecision, reason });
          }
          setPendingDecision(null);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingDecision, onSubmitDecision, reason]);

  const handleActionClick = (action: DecisionAction) => {
    // Every decision carries a written reason (docs/01-FEATURE-LOCK.md), not only approval.
    if (!isReasonValid) return;
    setPendingDecision(action);
    setUndoCountdown(5);
  };

  const handleUndo = () => {
    setPendingDecision(null);
    setUndoCountdown(5);
    if (onUndoDecision) {
      onUndoDecision();
    }
  };

  const actionBase =
    "flex h-10 items-center justify-center gap-2 rounded-lg border text-[13px] font-medium transition-colors duration-[120ms] select-none disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section
      aria-labelledby={`${submissionId}-decision`}
      data-submission-id={submissionId}
      className={cn(
        "rounded-lg border p-4 text-[13px] leading-5",
        isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      {/* Heading to its content: 16 */}
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 id={`${submissionId}-decision`} className="text-base font-medium leading-6 text-field-text">
          Decision
        </h3>
        <span className="flex items-center gap-2 font-mono tabular-nums text-field-muted">
          <span
            role="img"
            aria-label={`${approvalsCount} of ${requiredQuorum} approvals, ${rejectionsCount} rejections`}
            className="flex items-center gap-1"
          >
            {Array.from({ length: Math.max(requiredQuorum, approvalsCount) }, (_, i) => (
              <span key={`a${i}`} className={cn("size-2 rounded-full border", i < approvalsCount ? "border-verified bg-verified" : "border-field-inert")} />
            ))}
            {rejectionsCount > 0 && <span className="mx-1 h-3 w-px bg-field-hairline" />}
            {Array.from({ length: rejectionsCount }, (_, i) => (
              <span key={`r${i}`} className="size-2 rounded-full border border-fraud bg-fraud" />
            ))}
          </span>
          {approvalsCount} of {requiredQuorum} approvals
        </span>
      </div>

      {/* Within the section: 12 between blocks */}
      <div className="space-y-3">
        {isSplit ? (
          <p className={cn("flex items-start gap-2 rounded-sm border px-3 py-2", TINT.chain)}>
            <span className="mt-2 size-1 shrink-0 rounded-full bg-chain" aria-hidden="true" />
            Split decision. A verifier administrator casts the deciding vote.
          </p>
        ) : approvalsCount >= requiredQuorum ? (
          <p className={cn("flex items-start gap-2 rounded-sm border px-3 py-2", TINT.verified)}>
            <span className="mt-2 size-1 shrink-0 rounded-full bg-verified" aria-hidden="true" />
            Quorum reached. The submission is queued for anchoring.
          </p>
        ) : null}

        {pendingDecision && (
          <div className="flex items-center justify-between gap-3 rounded-sm border border-field-hairline bg-field-raised px-3 py-2">
            <span className="flex items-center gap-2 text-field-text">
              <Clock className="size-4 shrink-0 text-review" aria-hidden="true" />
              <span>
                Recorded as <span className="capitalize">{pendingDecision.replaceAll("_", " ").toLowerCase()}</span>. Committing in{" "}
                <span className="font-mono tabular-nums">{undoCountdown}s</span>
              </span>
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="flex h-8 items-center gap-1 rounded-sm border border-field-hairline bg-field-canopy px-3 text-review transition-colors duration-[120ms] hover:bg-field-raised"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Undo
            </button>
          </div>
        )}

        {userHasDecided && !pendingDecision && (
          <p className="flex items-center justify-between gap-3 rounded-sm border border-field-hairline bg-field-raised px-3 py-2 text-field-muted">
            <span>You have already decided on this submission.</span>
            <span className="capitalize text-field-text">{userDecision ? userDecision.replaceAll("_", " ").toLowerCase() : "Recorded"}</span>
          </p>
        )}

        {/* Label to its value: 4 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="decision-reason" className="text-field-text text-xs font-medium">
              Written reason
            </label>
            <span className={cn("font-mono tabular-nums text-xs transition-colors duration-[120ms]", isReasonValid ? "text-verified font-medium" : "text-field-muted")}>
              {reasonLength} / 20 {isReasonValid && "✓"}
            </span>
          </div>

          {/* Quick structured reason tags for More Proof / Dispute (doc 14) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-field-muted mr-1">Dispute tags:</span>
            {STRUCTURED_REASONS.map((r) => {
              const tag = `[${r.code}]`;
              const isSelected = reason.includes(tag);
              return (
                <button
                  key={r.code}
                  type="button"
                  disabled={Boolean(pendingDecision)}
                  onClick={() => {
                    if (isSelected) {
                      // Remove tag and detail
                      const updated = reason
                        .replace(`${tag} ${r.detail}`, "")
                        .replace(tag, "")
                        .trim();
                      setReason(updated);
                    } else {
                      // Append tag and detail
                      const addition = `${tag} ${r.detail}`;
                      setReason((prev) => (prev ? `${prev} ${addition}` : addition));
                    }
                  }}
                  className={cn(
                    "rounded border px-2 py-0.5 text-[11px] font-mono transition-colors",
                    isSelected
                      ? "border-review bg-[color-mix(in_srgb,var(--review)_20%,transparent)] text-review"
                      : "border-field-hairline bg-field-raised text-field-muted hover:text-field-text hover:border-field-inert",
                  )}
                  title={`${r.label}: ${r.detail}`}
                >
                  {isSelected ? `✓ ${r.label}` : `+ ${r.label}`}
                </button>
              );
            })}
          </div>

          <textarea
            id="decision-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={Boolean(pendingDecision)}
            placeholder="Required, 20 characters or more. What you checked and why (or click dispute tags above)."
            className={cn(
              "block w-full resize-none rounded-lg border px-3 py-2 text-[13px] leading-5 outline-none transition-colors duration-[120ms]",
              isPaper
                ? "border-paper-rule bg-paper text-paper-ink placeholder:text-paper-muted focus:border-paper-seal"
                : "border-field-hairline bg-field-raised text-field-text placeholder:text-field-inert focus:border-field-muted"
            )}
          />
        </div>

        {/* The one --signal fill on the screen: Approve */}
        <div className="grid grid-cols-3 gap-2" title="A decision is permanent once committed. You can undo it for 5 seconds.">
          <button
            type="button"
            onClick={() => handleActionClick("APPROVE")}
            disabled={!isReasonValid || Boolean(pendingDecision)}
            className={cn(
              actionBase,
              isReasonValid && !pendingDecision
                ? "border-signal bg-signal text-field-abyss hover:opacity-90"
                : "border-field-hairline bg-field-raised text-field-inert"
            )}
          >
            <Check className="size-4" aria-hidden="true" />
            Approve
            <kbd className="hidden rounded-sm bg-field-abyss/15 px-1 font-mono text-xs xl:inline">a</kbd>
          </button>
          <button
            type="button"
            onClick={() => handleActionClick("REJECT")}
            disabled={!isReasonValid || Boolean(pendingDecision)}
            className={cn(actionBase, TINT.fraud, "hover:bg-[color-mix(in_srgb,var(--fraud)_22%,transparent)]")}
          >
            <X className="size-4" aria-hidden="true" />
            Reject
            <kbd className="hidden rounded-sm border border-current px-1 font-mono text-xs xl:inline">r</kbd>
          </button>
          <button
            type="button"
            onClick={() => handleActionClick("REQUEST_MORE_PROOF")}
            disabled={!isReasonValid || Boolean(pendingDecision)}
            className={cn(actionBase, TINT.review, "hover:bg-[color-mix(in_srgb,var(--review)_22%,transparent)]")}
          >
            <HelpCircle className="size-4" aria-hidden="true" />
            More proof
            <kbd className="hidden rounded-sm border border-current px-1 font-mono text-xs xl:inline">m</kbd>
          </button>
        </div>

      </div>
    </section>
  );
}
