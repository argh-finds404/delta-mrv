"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  Compass,
  Keyboard,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import {
  QueuePane,
  EvidencePair,
  FindingCard,
  DecisionForm,
  type DecisionPayload,
} from "@/src/components/lab";
import {
  sampleLabSubmissions,
  type LabSubmission,
} from "@/src/components/lab/fixtures";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { EmptyState } from "@/src/components/empty-state/empty-state";
import { cn } from "@/src/lib/utils";

export default function EvidenceLabPage() {
  const [submissions, setSubmissions] = React.useState<LabSubmission[]>(sampleLabSubmissions);
  const [selectedId, setSelectedId] = React.useState<string>(sampleLabSubmissions[0].id);
  const [isVerifierAdmin, setIsVerifierAdmin] = React.useState<boolean>(false);
  const [emptyStateMode, setEmptyStateMode] = React.useState<"none" | "no-assignments" | "queue-clear">("none");
  const [isShortcutsOpen, setIsShortcutsOpen] = React.useState<boolean>(false);

  // Active selected submission
  const activeSubmission = React.useMemo(() => {
    return submissions.find((s) => s.id === selectedId) ?? submissions[0];
  }, [submissions, selectedId]);

  // Global Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keystrokes if typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        if (e.key === "Escape") {
          target.blur();
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isShortcutsOpen) {
          e.preventDefault();
          setIsShortcutsOpen(false);
        }
      } else if (e.key === "j") {
        // Move to next submission
        e.preventDefault();
        const currentIndex = submissions.findIndex((s) => s.id === selectedId);
        if (currentIndex < submissions.length - 1) {
          setSelectedId(submissions[currentIndex + 1].id);
        }
      } else if (e.key === "k") {
        // Move to previous submission
        e.preventDefault();
        const currentIndex = submissions.findIndex((s) => s.id === selectedId);
        if (currentIndex > 0) {
          setSelectedId(submissions[currentIndex - 1].id);
        }
      } else if (e.key === "a") {
        // Focus reason textarea for approval
        e.preventDefault();
        const reasonInput = document.getElementById("decision-reason");
        if (reasonInput) {
          reasonInput.focus();
        }
      } else if (e.key === "r") {
        // Focus reason textarea for reject
        e.preventDefault();
        const reasonInput = document.getElementById("decision-reason");
        if (reasonInput) {
          reasonInput.focus();
        }
      } else if (e.key === "m") {
        // Focus reason textarea for request more proof
        e.preventDefault();
        const reasonInput = document.getElementById("decision-reason");
        if (reasonInput) {
          reasonInput.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submissions, selectedId, isShortcutsOpen]);

  // Handle recorded review decisions
  const handleDecision = (payload: DecisionPayload) => {
    setSubmissions((prev) =>
      prev.map((sub) => {
        if (sub.id === selectedId) {
          const isApprove = payload.action === "APPROVE";
          const isReject = payload.action === "REJECT";
          const newApprovals = isApprove ? sub.approvalsCount + 1 : sub.approvalsCount;
          const newRejections = isReject ? sub.rejectionsCount + 1 : sub.rejectionsCount;
          const newStatus =
            newApprovals >= sub.requiredQuorum
              ? "APPROVED"
              : newRejections >= sub.requiredQuorum
              ? "REJECTED"
              : newApprovals === 1 && newRejections === 1
              ? "ESCALATED"
              : sub.status;

          return {
            ...sub,
            userHasDecided: true,
            userDecision: payload.action,
            approvalsCount: newApprovals,
            rejectionsCount: newRejections,
            status: newStatus,
          };
        }
        return sub;
      })
    );
  };

  return (
    <div className="flex flex-col h-screen bg-field-abyss text-field-text overflow-hidden font-sans">
      {/* Top Workspace Header Bar (Chrome is neutral per §1, no signal color) */}
      <header className="h-12 border-b border-field-hairline bg-field-canopy px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/kitchen-sink"
            className="flex items-center gap-2 group text-field-muted hover:text-field-text transition-colors"
          >
            <div className="flex size-6 items-center justify-center rounded bg-field-raised border border-field-hairline font-serif font-bold text-field-text text-xs">
              Δ
            </div>
            <span className="font-medium text-xs tracking-tight text-field-text">
              Delta MRV
            </span>
            <span className="text-field-inert">/</span>
            <span className="text-xs text-field-muted">Evidence Lab</span>
          </Link>
        </div>

        {/* Workspace Controls & State Toggles */}
        <div className="flex items-center gap-2 text-xs">
          {/* Admin Role Toggle (Tint rule, sentence case) */}
          <button
            type="button"
            onClick={() => setIsVerifierAdmin(!isVerifierAdmin)}
            className={cn(
              "px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5",
              isVerifierAdmin
                ? "bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] border-[color-mix(in_srgb,var(--chain)_35%,transparent)] text-chain font-medium"
                : "bg-field-raised text-field-muted border-field-hairline hover:text-field-text"
            )}
            title="Toggle between regular verifier and verifier administrator (pins escalated cases)"
          >
            <UserCheck className="size-3.5" />
            <span className="hidden sm:inline">Admin view:</span>
            <span>{isVerifierAdmin ? "On" : "Off"}</span>
          </button>

          {/* Empty State Simulator (Neutral surface shifts) */}
          <div className="hidden md:flex items-center rounded border border-field-hairline bg-field-raised p-0.5">
            <button
              type="button"
              onClick={() => setEmptyStateMode("none")}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] transition-colors",
                emptyStateMode === "none" ? "bg-field-canopy text-field-text font-medium" : "text-field-muted"
              )}
            >
              Queue
            </button>
            <button
              type="button"
              onClick={() => setEmptyStateMode("no-assignments")}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] transition-colors",
                emptyStateMode === "no-assignments" ? "bg-field-canopy text-field-text font-medium" : "text-field-muted"
              )}
            >
              E5
            </button>
            <button
              type="button"
              onClick={() => setEmptyStateMode("queue-clear")}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] transition-colors",
                emptyStateMode === "queue-clear" ? "bg-field-canopy text-field-text font-medium" : "text-field-muted"
              )}
            >
              E5b
            </button>
          </div>

          {/* Keyboard Shortcuts Button */}
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="px-2.5 py-1 rounded border border-field-hairline bg-field-raised text-field-muted hover:text-field-text flex items-center gap-1.5 transition-colors"
            title="View keyboard shortcuts (?)"
          >
            <Keyboard className="size-3.5" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="px-1 text-[10px] rounded bg-field-canopy border border-field-hairline font-mono">
              ?
            </kbd>
          </button>
        </div>
      </header>

      {/* Main 3-Pane Evidence Lab Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pane 1: Queue (280px / 320px) */}
        <QueuePane
          submissions={submissions}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          isVerifierAdmin={isVerifierAdmin}
          emptyStateMode={emptyStateMode}
        />

        {emptyStateMode === "none" && activeSubmission ? (
          <>
            {/* Pane 2: Evidence Viewport (Flexible Center, comparison slider dominates per §3) */}
            <main className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3 border-r border-field-hairline bg-field-abyss">
              {/* Collapsed One-Line Header per docs/18-VISUAL-CORRECTION.md §2 */}
              <div className="flex items-center justify-between gap-3 border-b border-field-hairline pb-2.5 select-none">
                <div className="flex items-baseline gap-2 min-w-0">
                  <h1 className="text-sm font-medium text-field-text truncate">
                    {activeSubmission.projectTitle}
                  </h1>
                  <span className="text-field-muted text-xs">·</span>
                  <span className="text-xs text-field-muted truncate">
                    {activeSubmission.ownerOrgName}
                  </span>
                </div>

                <StatusBadge status={activeSubmission.status} />
              </div>

              {/* Primary Interaction: Comparison Slider dominates the pane */}
              <EvidencePair
                before={activeSubmission.beforeImage}
                after={activeSubmission.afterImage}
                beforeLabel="Before"
                afterLabel="After"
              />

              {/* Quiet Telemetry Detail Strip */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Camera & EXIF */}
                <div className="rounded-lg border border-field-hairline bg-field-canopy p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-field-hairline/50 pb-1.5">
                    <span className="font-medium text-field-text flex items-center gap-1.5">
                      <Camera className="size-3.5 text-field-muted" />
                      Hardware and metadata
                    </span>
                    <span className="text-field-muted text-[11px]">
                      {activeSubmission.activityType}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-field-muted">
                    <div className="flex items-center justify-between">
                      <span>Camera</span>
                      <span className="text-field-text">
                        {activeSubmission.exif.cameraModel ?? "Embedded sensor"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Capture time</span>
                      <span className="font-mono tabular-nums text-field-text">
                        {activeSubmission.afterImage.capturedAt}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>GPS coordinate</span>
                      <span className="font-mono tabular-nums text-field-text">
                        {activeSubmission.exif.gps
                          ? `${activeSubmission.exif.gps.lat.toFixed(4)}° N, ${activeSubmission.exif.gps.lng.toFixed(4)}° E`
                          : "Unavailable"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boundary Conformance */}
                <div className="rounded-lg border border-field-hairline bg-field-canopy p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-field-hairline/50 pb-1.5">
                    <span className="font-medium text-field-text flex items-center gap-1.5">
                      <Compass className="size-3.5 text-field-muted" />
                      Boundary conformance
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] border",
                        activeSubmission.exif.insideBoundary
                          ? "bg-[color-mix(in_srgb,var(--verified)_14%,transparent)] border-[color-mix(in_srgb,var(--verified)_35%,transparent)] text-verified"
                          : "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review"
                      )}
                    >
                      {activeSubmission.exif.insideBoundary
                        ? "Inside polygon"
                        : `${activeSubmission.exif.distanceToBoundaryMeters?.toFixed(1)} m outside`}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-field-muted">
                    <div className="flex items-center justify-between">
                      <span>Assigned verifiers</span>
                      <span className="text-field-text">2 independent organisations</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>SHA-256 digest</span>
                      <HashDisplay hash={activeSubmission.afterImage.sha256} variant="truncated" />
                    </div>
                  </div>
                </div>
              </div>
            </main>

            {/* Pane 3: Forensic Findings & Decision Form (360px) */}
            <aside className="w-full lg:w-[380px] flex-shrink-0 flex flex-col overflow-y-auto p-4 space-y-4 bg-field-canopy">
              {/* Findings Header (Sentence case, no ALL CAPS, no font-mono on title) */}
              <div className="flex items-center justify-between border-b border-field-hairline pb-2 text-xs">
                <h3 className="font-medium text-field-text">
                  Findings ({activeSubmission.findings.length})
                </h3>
                <span className="text-[11px] text-field-muted">
                  Deterministic pipeline
                </span>
              </div>

              {/* Findings List (Tier 1 by default, nothing expanded on load) */}
              <div className="space-y-2.5">
                {activeSubmission.findings.length === 0 ? (
                  <div className="rounded-lg border border-field-hairline bg-field-raised p-4 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-field-text">
                      <ShieldCheck className="size-4 text-verified" />
                      <span>No findings</span>
                    </div>
                    <p className="text-field-muted leading-relaxed text-[11px]">
                      All seven deterministic checks completed and none produced a finding. This submission still requires independent review.
                    </p>
                  </div>
                ) : (
                  activeSubmission.findings
                    .slice()
                    .sort((a, b) => {
                      const order = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
                      return order[a.severity] - order[b.severity];
                    })
                    .map((finding) => (
                      <FindingCard key={finding.id} finding={finding} />
                    ))
                )}
              </div>

              {/* Review Decision Form */}
              <div className="pt-2 border-t border-field-hairline">
                <DecisionForm
                  submissionId={activeSubmission.id}
                  approvalsCount={activeSubmission.approvalsCount}
                  rejectionsCount={activeSubmission.rejectionsCount}
                  requiredQuorum={activeSubmission.requiredQuorum}
                  isEscalated={activeSubmission.isEscalated || activeSubmission.status === "ESCALATED"}
                  userHasDecided={activeSubmission.userHasDecided}
                  userDecision={activeSubmission.userDecision}
                  onSubmitDecision={handleDecision}
                />
              </div>
            </aside>
          </>
        ) : (
          /* Empty Workspace Center State */
          <div className="flex-1 flex items-center justify-center p-8 bg-field-abyss">
            <EmptyState
              title={
                emptyStateMode === "no-assignments"
                  ? "Your review queue"
                  : "Queue clear"
              }
              reason={
                emptyStateMode === "no-assignments"
                  ? "Your organisation is not assigned to any projects yet. A platform administrator assigns verifier organisations to the projects they audit."
                  : "Nothing is awaiting your review. New submissions appear here automatically once forensic processing completes."
              }
              honestNote={
                emptyStateMode === "no-assignments"
                  ? "Independent verifiers only audit assigned workloads. Platform administrators assign audit lanes."
                  : "Last reviewed 14 minutes ago."
              }
              action={
                emptyStateMode === "no-assignments"
                  ? {
                      label: "Contact support",
                      onClick: () => alert("Redirecting to administrator support..."),
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Modal Sheet */}
      {isShortcutsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-field-abyss/80"
          onClick={() => setIsShortcutsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-field-hairline bg-field-canopy p-5 space-y-4 text-xs select-none"
          >
            <div className="flex items-center justify-between border-b border-field-hairline pb-3">
              <span className="font-medium text-sm text-field-text flex items-center gap-2">
                <Keyboard className="size-4 text-field-muted" /> Keyboard shortcuts
              </span>
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(false)}
                className="p-1 rounded hover:bg-field-raised text-field-muted hover:text-field-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Next submission in queue</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono font-medium text-field-text">
                  j
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Previous submission in queue</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono font-medium text-field-text">
                  k
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Open / select submission</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono text-field-text">
                  Enter
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Approve (focus reason)</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono font-medium text-verified">
                  a
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Reject submission</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono font-medium text-fraud">
                  r
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Request more proof</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono font-medium text-review">
                  m
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Step comparison slider</span>
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-field-raised border border-field-hairline">←</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-field-raised border border-field-hairline">→</kbd>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-field-hairline/50">
                <span className="text-field-muted">Toggle shortcuts sheet</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono text-field-text">
                  ?
                </kbd>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-field-muted">Close modal / sheet</span>
                <kbd className="px-2 py-0.5 rounded bg-field-raised border border-field-hairline font-mono text-field-text">
                  Esc
                </kbd>
              </div>
            </div>

            <p className="text-[11px] text-field-muted pt-2 border-t border-field-hairline">
              Every keyboard action corresponds to a visible control on screen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
