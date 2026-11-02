"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BitGrid } from "@/src/components/bit-grid/bit-grid";
import type { LabFinding } from "./fixtures";
import { cn } from "@/src/lib/utils";

export interface FindingCardProps {
  /** The forensic finding data */
  finding: LabFinding;
  /** Optional theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * Maps database finding enums to plain language per docs/18-VISUAL-CORRECTION.md §2.
 */
export const findingKindDisplayMap: Record<string, string> = {
  PERCEPTUAL_MATCH_OTHER_ORG: "Matches another organisation's evidence",
  PERCEPTUAL_MATCH_SAME_ORG: "Matches your organisation's other project",
  PERCEPTUAL_MATCH_SAME_PROJECT: "Similar to an earlier photo in this project",
  EXACT_DUPLICATE_OTHER_ORG: "Identical file already submitted elsewhere",
  EXACT_DUPLICATE_SAME_ORG: "Identical file submitted in another project",
  EXACT_DUPLICATE_SAME_PROJECT: "Identical file submitted in this project",
  GPS_INSIDE_BOUNDARY: "Located inside the project boundary",
  GPS_OUTSIDE_BOUNDARY: "Taken outside the project boundary",
  GPS_WITHIN_TOLERANCE: "Just outside the boundary, within tolerance",
  GPS_MISSING: "No location recorded in the photo",
  EXIF_TIMESTAMP_MISSING: "No capture time recorded",
  EXIF_TIMESTAMP_IMPLAUSIBLE: "Capture time does not fit the project dates",
  EXIF_FULLY_STRIPPED: "All camera metadata removed",
  NO_VISIBLE_CHANGE: "Before and after look nearly identical",
  CLIENT_HASH_MISMATCH: "File changed between the device and the server",
  AI_OBSERVATION: "Advisory observation",
};

/**
 * FindingCard — Three-tier forensic finding disclosure.
 * Authority: docs/18-VISUAL-CORRECTION.md §2.
 * Tier 1 (always visible): A severity dot and a sentence. Plain language only. Nothing expanded on load.
 * Tier 2 ("Show the numbers"): A four-row definition list in monospace.
 * Tier 3 ("Show the raw comparison"): Bit grids, full hashes, images, opaque match ref, raw enum code.
 */
export function FindingCard({
  finding,
  theme = "field",
  className,
}: FindingCardProps) {
  const isPaper = theme === "paper";

  // Tier 2 ("Show the numbers") and Tier 3 ("Show the raw comparison")
  // Rule: Nothing expanded on load per docs/18-VISUAL-CORRECTION.md §2 & §4.
  const [showNumbers, setShowNumbers] = React.useState<boolean>(false);
  const [showRawComparison, setShowRawComparison] = React.useState<boolean>(false);

  const plainTitle = findingKindDisplayMap[finding.kind] ?? finding.kind;

  // Severity color tokens
  const dotColorClass = {
    HIGH: "text-fraud",
    MEDIUM: "text-review",
    LOW: "text-field-muted",
    INFO: "text-field-muted",
  }[finding.severity];

  const hasPerceptualData =
    finding.evidence.beforeHash && finding.evidence.compareHash;

  const hasImageData =
    Boolean(finding.evidence.beforeImageUrl && finding.evidence.matchImageUrl);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      {/* Tier 1: Verdict (Always visible, dot + two short lines, nothing else) */}
      <div className="p-3.5 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            {/* Line 1: 4px dot + Plain language verdict */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full shrink-0 bg-current",
                  dotColorClass
                )}
                aria-hidden="true"
              />
              <h4 className="text-xs font-medium leading-snug">
                {plainTitle}
              </h4>
            </div>

            {/* Line 2: Plain sentence in muted text */}
            <p className="text-xs text-field-muted leading-relaxed pl-4">
              {finding.humanReason}
            </p>
          </div>

          {/* Tier 2 Disclosure Trigger */}
          <button
            type="button"
            onClick={() => setShowNumbers((prev) => !prev)}
            className={cn(
              "text-xs font-sans text-field-muted hover:text-field-text px-2 py-1 rounded transition-colors shrink-0 flex items-center gap-1",
              showNumbers && "text-field-text font-medium"
            )}
          >
            <span>{showNumbers ? "Hide numbers" : "Show the numbers"}</span>
            {showNumbers ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Tier 2: The Numbers (Four-row definition list in monospace) */}
      {showNumbers && (
        <div
          className={cn(
            "border-t px-4 py-3 text-xs space-y-3",
            isPaper ? "border-paper-rule bg-paper" : "border-field-hairline bg-field-abyss"
          )}
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
            {/* Row 1: Measured value */}
            <div className="flex items-baseline justify-between border-b border-field-hairline/40 pb-1">
              <dt className="text-field-muted">
                {finding.evidence.hammingDistance !== undefined
                  ? "Perceptual hash distance"
                  : finding.evidence.distanceMeters !== undefined
                  ? "Distance to boundary"
                  : "Measured delta"}
              </dt>
              <dd className="font-mono tabular-nums text-field-text">
                {finding.evidence.hammingDistance !== undefined
                  ? `${finding.evidence.hammingDistance} bits`
                  : finding.evidence.distanceMeters !== undefined
                  ? `${finding.evidence.distanceMeters.toFixed(1)} m`
                  : "Recorded"}
              </dd>
            </div>

            {/* Row 2: Flagging threshold */}
            <div className="flex items-baseline justify-between border-b border-field-hairline/40 pb-1">
              <dt className="text-field-muted">Flagging threshold</dt>
              <dd className="font-mono tabular-nums text-field-text">
                {finding.evidence.hammingDistance !== undefined
                  ? `below ${finding.evidence.threshold}`
                  : finding.evidence.toleranceMeters !== undefined
                  ? `within ${finding.evidence.toleranceMeters.toFixed(1)} m`
                  : `zero tolerance`}
              </dd>
            </div>

            {/* Row 3: Match scope */}
            <div className="flex items-baseline justify-between border-b border-field-hairline/40 pb-1">
              <dt className="text-field-muted">Match scope</dt>
              <dd className="text-field-text">
                {finding.kind.includes("OTHER_ORG")
                  ? "a different organisation"
                  : finding.kind.includes("SAME_ORG")
                  ? "same organisation, other project"
                  : finding.kind.includes("BOUNDARY")
                  ? "registered polygon perimeter"
                  : "same project plot"}
              </dd>
            </div>

            {/* Row 4: Rule version */}
            <div className="flex items-baseline justify-between border-b border-field-hairline/40 pb-1">
              <dt className="text-field-muted">Rule version</dt>
              <dd className="font-mono tabular-nums text-field-text">
                {finding.evidence.ruleVersion || "forensics.v1"}
              </dd>
            </div>
          </dl>

          {/* Tier 3 Disclosure Trigger */}
          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRawComparison((prev) => !prev)}
              className="text-xs text-field-muted hover:text-field-text underline underline-offset-2 transition-colors flex items-center gap-1"
            >
              <span>
                {showRawComparison ? "Hide raw comparison" : "Show the raw comparison"}
              </span>
              {showRawComparison ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tier 3: Raw Artefacts (Bit grids, full hashes, images, opaque match ref, finding code) */}
      {showNumbers && showRawComparison && (
        <div
          className={cn(
            "border-t p-4 space-y-4 text-xs",
            isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
          )}
        >
          {/* Finding Code (raw enum is visible here only per §2) */}
          <div className="flex items-center justify-between pb-2 border-b border-inherit">
            <span className="text-field-muted">Finding code</span>
            <code className="font-mono text-field-text text-[11px] bg-field-raised px-1.5 py-0.5 rounded border border-field-hairline">
              {finding.kind}
            </code>
          </div>

          {/* 8×8 Bit Grid Comparison */}
          {hasPerceptualData && (
            <div className="space-y-2">
              <span className="text-field-muted block">
                64-bit difference hash comparison
              </span>
              <BitGrid
                hash={finding.evidence.beforeHash!}
                compareHash={finding.evidence.compareHash!}
                hammingDistance={finding.evidence.hammingDistance}
                threshold={finding.evidence.threshold}
                label="Candidate submission"
                compareLabel="Matched record"
                theme={theme}
              />
            </div>
          )}

          {/* Raw Image Artefacts */}
          {hasImageData && (
            <div className="space-y-2">
              <span className="text-field-muted block">
                Image frames
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-field-hairline p-2 space-y-1 bg-field-abyss">
                  <div className="aspect-[4/3] rounded overflow-hidden relative">
                    <Image
                      src={finding.evidence.beforeImageUrl!}
                      alt="Candidate frame"
                      width={400}
                      height={300}
                      unoptimized
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] text-field-muted block text-center">
                    Candidate frame
                  </span>
                </div>

                <div className="rounded border border-field-hairline p-2 space-y-1 bg-field-abyss">
                  <div className="aspect-[4/3] rounded overflow-hidden relative">
                    <Image
                      src={finding.evidence.matchImageUrl!}
                      alt="Matched record"
                      width={400}
                      height={300}
                      unoptimized
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] text-fraud block text-center font-medium">
                    Matched record
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Opaque Match Reference */}
          {finding.evidence.matchRef && (
            <div className="p-2.5 rounded border border-field-hairline bg-field-raised/60 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-field-muted">Match reference</span>
                <span className="font-mono text-field-text tabular-nums">
                  {finding.evidence.matchRef}
                </span>
              </div>
              <p className="text-[11px] text-field-muted leading-relaxed">
                Source organisation identifier is redacted under cross-tenant privacy controls.
              </p>
            </div>
          )}

          {/* GPS Telemetry Dump if applicable */}
          {finding.evidence.exifGps && (
            <div className="flex items-center justify-between text-[11px] font-mono border-t border-inherit pt-2">
              <span className="text-field-muted">GPS coordinate</span>
              <span className="tabular-nums text-field-text">
                {finding.evidence.exifGps.lat.toFixed(6)}° N, {finding.evidence.exifGps.lng.toFixed(6)}° E
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
