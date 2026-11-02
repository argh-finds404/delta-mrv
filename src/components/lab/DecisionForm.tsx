"use client";

import * as React from "react";
import {
  Check,
  X,
  HelpCircle,
  RotateCcw,
  Clock,
} from "lucide-react";
import { QuorumMeter } from "@/src/components/quorum-meter/quorum-meter";
import { cn } from "@/src/lib/utils";

export type DecisionAction = "APPROVE" | "REJECT" | "REQUEST_MORE_PROOF";

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
    if (action === "APPROVE" && !isReasonValid) return;
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

  return (
    <div
      data-submission-id={submissionId}
      className={cn(
        "rounded-lg border p-4 space-y-4 text-xs font-sans transition-colors",
        isPaper
          ? "border-paper-rule bg-paper-card"
          : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      {/* 1. Explicit Quorum Tally & Split Decision Banner */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-field-muted">
          <span className="font-medium text-field-text">
            Consensus quorum status
          </span>
          <span className="font-mono tabular-nums text-[11px]">
            {approvalsCount} of {requiredQuorum} approvals
          </span>
        </div>

        <QuorumMeter
          approvals={approvalsCount}
          rejections={rejectionsCount}
          required={requiredQuorum}
          isEscalated={isSplit}
          theme={theme}
        />

        {/* Explicit Tally Wording per docs/14-PAGE-SPEC.md §5 & docs/18 §1 Tint Rule */}
        {isSplit ? (
          <div className="rounded border border-[color-mix(in_srgb,var(--chain)_35%,transparent)] bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] p-2.5 flex items-start gap-2 text-chain text-xs leading-relaxed">
            <span className="size-1 rounded-full bg-chain shrink-0 mt-1.5" />
            <div>
              <strong className="block font-medium">Split decision</strong>
              Split decision — awaiting a deciding vote from a verifier administrator.
            </div>
          </div>
        ) : approvalsCount >= requiredQuorum ? (
          <div className="rounded border border-[color-mix(in_srgb,var(--verified)_35%,transparent)] bg-[color-mix(in_srgb,var(--verified)_14%,transparent)] p-2.5 flex items-start gap-2 text-verified text-xs">
            <span className="size-1 rounded-full bg-verified shrink-0 mt-1.5" />
            <span>
              Quorum reached ({approvalsCount} approvals). Submission is queued for Merkle root anchoring.
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-field-muted leading-relaxed">
            {approvalsCount === 1
              ? "1 of 2 approvals · awaiting a second independent verifier."
              : "0 of 2 approvals · awaiting initial evaluation from assigned verifiers."}
          </p>
        )}
      </div>

      {/* 2. Transient Undo Window Banner */}
      {pendingDecision && (
        <div className="rounded border border-field-hairline bg-field-raised p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-field-text">
            <Clock className="size-3.5 text-review" />
            <span>
              Decision recorded as <strong className="capitalize">{pendingDecision.toLowerCase()}</strong>. Committing in{" "}
              <strong className="font-mono tabular-nums">{undoCountdown}s</strong>...
            </span>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            className="px-2 py-0.5 rounded bg-field-canopy border border-field-hairline hover:bg-field-raised text-xs text-review flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="size-3" /> Undo
          </button>
        </div>
      )}

      {/* 3. User Already Decided Note */}
      {userHasDecided && !pendingDecision && (
        <div className="rounded border border-field-hairline bg-field-raised/60 p-2.5 flex items-center justify-between text-[11px] text-field-muted">
          <span>You have already recorded a decision on this submission.</span>
          <span className="font-medium text-field-text capitalize">
            {userDecision ? userDecision.toLowerCase() : "Recorded"}
          </span>
        </div>
      )}

      {/* 4. Mandatory Reason Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label
            htmlFor="decision-reason"
            className="font-medium text-field-text"
          >
            Written reason <span className="text-fraud">*</span>
          </label>
          <span
            className={cn(
              "font-mono tabular-nums text-[11px] transition-colors",
              isReasonValid ? "text-verified font-medium" : "text-field-muted"
            )}
          >
            {reasonLength} / 20 min
          </span>
        </div>

        <textarea
          id="decision-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={Boolean(pendingDecision)}
          placeholder="State specific evidentiary basis for this decision (species match, GPS boundary check, change delta)..."
          className={cn(
            "w-full rounded border p-2.5 text-xs font-sans leading-relaxed transition-colors resize-none focus:outline-none",
            isPaper
              ? "border-paper-rule bg-paper text-paper-ink placeholder:text-paper-muted focus:border-paper-seal"
              : "border-field-hairline bg-field-raised text-field-text placeholder:text-field-inert focus:border-field-muted"
          )}
        />

        {!isReasonValid && (
          <p className="text-[11px] text-review flex items-center gap-1">
            <HelpCircle className="size-3 shrink-0" />
            Approve disabled: minimum 20 characters required before approving.
          </p>
        )}
      </div>

      {/* 5. Three Actions: EXACTLY ONE --signal button per screen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
        {/* Approve (a) — THE SINGLE PRIMARY ACTION ON SCREEN */}
        <button
          type="button"
          onClick={() => handleActionClick("APPROVE")}
          disabled={!isReasonValid || Boolean(pendingDecision)}
          className={cn(
            "py-2 px-3 rounded border font-medium flex items-center justify-center gap-1.5 transition-colors select-none",
            isReasonValid
              ? "bg-signal text-field-abyss border-signal hover:opacity-90 cursor-pointer"
              : "bg-field-raised text-field-inert border-field-hairline opacity-50 cursor-not-allowed"
          )}
        >
          <Check className="size-3.5" />
          <span>Approve</span>
          <kbd className="hidden sm:inline px-1 text-[10px] rounded bg-field-abyss/20">a</kbd>
        </button>

        {/* Reject (r) — Tint rule */}
        <button
          type="button"
          onClick={() => handleActionClick("REJECT")}
          disabled={Boolean(pendingDecision)}
          className="py-2 px-3 rounded border font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud hover:bg-[color-mix(in_srgb,var(--fraud)_22%,transparent)]"
        >
          <X className="size-3.5" />
          <span>Reject</span>
          <kbd className="hidden sm:inline px-1 text-[10px] rounded border border-inherit">r</kbd>
        </button>

        {/* Request More Proof (m) — Tint rule */}
        <button
          type="button"
          onClick={() => handleActionClick("REQUEST_MORE_PROOF")}
          disabled={Boolean(pendingDecision)}
          className="py-2 px-2.5 rounded border font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer select-none text-[11px] bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review hover:bg-[color-mix(in_srgb,var(--review)_22%,transparent)]"
        >
          <HelpCircle className="size-3.5" />
          <span>More proof</span>
          <kbd className="hidden sm:inline px-1 text-[10px] rounded border border-inherit">m</kbd>
        </button>
      </div>

      <p className="text-[11px] text-field-muted pt-1 text-center">
        No confirmation dialog · Decisions are append-only and permanent.
      </p>
    </div>
  );
}
