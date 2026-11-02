"use client";

import * as React from "react";
import Link from "next/link";
import { X, ArrowRight, MapPin, Building, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { VerificationBadge, StatusBadge } from "@/src/components";
import type { AtlasProject } from "./fixtures";
import { cn } from "@/src/lib/utils";

export interface ProjectDrawerProps {
  /** The selected project data to display */
  project: AtlasProject | null;
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Dismiss handler */
  onClose: () => void;
  /** Theme: field or paper (default: paper for public Atlas per docs/14 §2) */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * ProjectDrawer — Slide-over panel on desktop, bottom sheet on mobile.
 * Authority: docs/14-PAGE-SPEC.md §2 (Atlas drawer contents).
 * Displays title, owner org, activity type, reported impact, verification status,
 * breakdown of submission statuses, and link to full project page.
 */
export function ProjectDrawer({
  project,
  isOpen,
  onClose,
  theme = "paper",
  className,
}: ProjectDrawerProps) {
  if (!isOpen || !project) {
    return null;
  }

  const isPaper = theme === "paper";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Project details for ${project.title}`}
      className={cn(
        // Mobile bottom sheet / Desktop slide-over
        "fixed z-40 transition-transform duration-200 ease-out",
        "bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-xl border-t shadow-2xl",
        "md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[420px] md:max-h-full md:rounded-none md:border-t-0 md:border-l",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      {/* Mobile drag handle bar */}
      <div className="flex justify-center pt-2 pb-1 md:hidden">
        <div
          className={cn(
            "h-1 w-10 rounded-full",
            isPaper ? "bg-paper-rule" : "bg-field-hairline"
          )}
        />
      </div>

      <div className="p-5 md:p-6 space-y-5">
        {/* Header & Close Button */}
        <div className="flex items-start justify-between gap-3 border-b pb-4 border-inherit">
          <div className="space-y-1">
            <span
              className={cn(
                "font-mono uppercase tracking-wider text-[11px] block",
                isPaper ? "text-paper-muted" : "text-field-muted"
              )}
            >
              {project.activityType}
            </span>
            <h2
              className={cn(
                "text-lg font-medium leading-snug",
                isPaper ? "font-serif text-paper-ink" : "text-field-text font-sans"
              )}
            >
              {project.title}
            </h2>
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs",
                isPaper ? "text-paper-muted" : "text-field-muted"
              )}
            >
              <Building className="size-3.5 shrink-0" />
              <span>{project.ownerOrg}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close project drawer"
            className={cn(
              "rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal",
              isPaper
                ? "text-paper-muted hover:bg-paper hover:text-paper-ink"
                : "text-field-muted hover:bg-field-raised hover:text-field-text"
            )}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Verification Status Badge */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-xs font-mono uppercase tracking-wider",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            Integrity Status:
          </span>
          <VerificationBadge
            state={project.verificationStatus}
            detail="Public Anchor"
            theme={theme}
          />
        </div>

        {/* Geographic Telemetry (Always Fuzzed for Public Atlas per docs/14 §2) */}
        <div
          className={cn(
            "rounded border p-3 text-xs space-y-1",
            isPaper
              ? "border-paper-rule bg-paper"
              : "border-field-hairline bg-field-abyss/80"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin className="size-3.5 text-signal shrink-0" />
              <span>{project.location.region}</span>
            </span>
            <span
              className={cn(
                "font-mono text-[10px] uppercase rounded px-1.5 py-0.5 border",
                isPaper
                  ? "border-paper-rule text-paper-muted"
                  : "border-field-hairline text-field-muted"
              )}
            >
              Fuzzed Centroid
            </span>
          </div>
          <div
            className={cn(
              "font-mono text-[11px] tabular-nums",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            Coordinates: [{project.location.coordinatesFuzzed[0].toFixed(4)},{" "}
            {project.location.coordinatesFuzzed[1].toFixed(4)}]
          </div>
          <p
            className={cn(
              "text-[11px] italic pt-1",
              isPaper ? "text-paper-muted/80" : "text-field-inert"
            )}
          >
            Exact boundary polygon unlocked only for authorised auditor sessions.
          </p>
        </div>

        {/* Claimed vs Verified Track Record Block */}
        <div
          className={cn(
            "rounded-lg border p-4 space-y-3",
            isPaper
              ? "border-paper-rule bg-paper"
              : "border-field-hairline bg-field-raised/60"
          )}
        >
          <span
            className={cn(
              "text-[11px] font-mono uppercase tracking-wider block",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            Claimed vs Verified Track Record
          </span>

          <div className="space-y-1.5">
            <div className="flex items-start justify-between text-xs">
              <span
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Reported Claim:
              </span>
              <span className="font-mono tabular-nums font-medium text-right max-w-[200px]">
                {project.reportedImpact}
              </span>
            </div>

            <div className="flex items-start justify-between text-xs">
              <span
                className={cn(
                  "text-xs flex items-center gap-1",
                  isPaper ? "text-paper-seal" : "text-field-text"
                )}
              >
                <CheckCircle2 className="size-3 text-verified shrink-0" />
                <span>Anchored Proof:</span>
              </span>
              <span className="font-mono tabular-nums font-semibold text-right max-w-[200px]">
                {project.verifiedImpact}
              </span>
            </div>
          </div>

          {/* The Honest Gap */}
          <div
            className={cn(
              "rounded p-2 border text-xs font-mono",
              isPaper
                ? "border-[#E8A33D]/30 bg-[#E8A33D]/10 text-[#8F5B10]"
                : "border-[#E8A33D]/30 bg-[#E8A33D]/10 text-review"
            )}
          >
            <div className="flex items-start gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Unverified Gap: </span>
                <span>{project.claimedVsVerifiedGap}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submission Counts by Status Breakdown */}
        <div className="space-y-2">
          <span
            className={cn(
              "text-[11px] font-mono uppercase tracking-wider block",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            Submission Status Ledger ({Object.values(project.submissionCounts).reduce((a, b) => a + b, 0)} total)
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="flex items-center justify-between p-1.5 rounded border border-inherit">
              <StatusBadge status="ANCHORED" theme={theme} />
              <span className="font-semibold tabular-nums">
                {project.submissionCounts.anchored}
              </span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded border border-inherit">
              <StatusBadge status="APPROVED" theme={theme} />
              <span className="font-semibold tabular-nums">
                {project.submissionCounts.approved}
              </span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded border border-inherit">
              <StatusBadge status="IN_REVIEW" theme={theme} />
              <span className="tabular-nums opacity-80">
                {project.submissionCounts.inReview}
              </span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded border border-inherit">
              <StatusBadge status="NEEDS_MORE_PROOF" theme={theme} />
              <span className="tabular-nums opacity-80">
                {project.submissionCounts.needsMoreProof}
              </span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded border border-inherit">
              <StatusBadge status="PENDING_FORENSICS" theme={theme} />
              <span className="tabular-nums opacity-80">
                {project.submissionCounts.pendingForensics}
              </span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded border border-inherit">
              <StatusBadge status="REJECTED" theme={theme} />
              <span className="tabular-nums opacity-80 text-fraud">
                {project.submissionCounts.rejected}
              </span>
            </div>
          </div>
        </div>

        {/* Assigned Verifier Organisations */}
        <div className="space-y-1.5 pt-2 border-t border-inherit">
          <span
            className={cn(
              "text-[11px] font-mono uppercase tracking-wider flex items-center gap-1",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            <ShieldCheck className="size-3.5 text-signal" />
            <span>Assigned Independent Verifiers</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {project.assignedVerifiers.map((verifier) => (
              <span
                key={verifier.slug}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-sans border",
                  isPaper
                    ? "bg-paper border-paper-rule text-paper-ink"
                    : "bg-field-raised border-field-hairline text-field-text"
                )}
              >
                {verifier.name}
              </span>
            ))}
          </div>
        </div>

        {/* CTA to Project Detail Page */}
        <div className="pt-3">
          <Link
            href={`/p/${project.slug}`}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal",
              isPaper
                ? "bg-paper-seal text-white hover:bg-paper-seal/90"
                : "bg-signal text-[#0C1413] hover:bg-signal/90"
            )}
          >
            <span>Open complete project page &amp; evidence</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

