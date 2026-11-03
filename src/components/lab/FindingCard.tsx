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
 * Tier 1, line two: the magnitude, in words a non-specialist reads. No threshold,
 * no rule version, no editorial (docs/19-LAYOUT-SPEC.md §3). Each sentence is kept
 * to one line of a 400px pane: 46 characters at most.
 */
export function findingSummary(finding: LabFinding): string {
  const { kind, evidence } = finding;
  const bits = evidence.hammingDistance;
  const metres = evidence.distanceMeters;

  if (kind.startsWith("PERCEPTUAL_MATCH") && bits !== undefined) {
    const closeness = bits <= 2 ? "Near-identical image" : bits <= 5 ? "Very close visual match" : "Close visual match";
    return `${closeness} — ${bits} of 64 bits differ.`;
  }
  if (kind === "NO_VISIBLE_CHANGE" && bits !== undefined) return `Only ${bits} of 64 bits differ between the photos.`;
  if (kind.startsWith("EXACT_DUPLICATE")) return "The file is byte-for-byte the same.";
  if (kind === "GPS_OUTSIDE_BOUNDARY" && metres !== undefined) return `About ${Math.round(metres)} m outside the boundary.`;
  if (kind === "GPS_WITHIN_TOLERANCE" && metres !== undefined) return `About ${Math.round(metres)} m outside, within the margin.`;
  if (kind === "GPS_INSIDE_BOUNDARY") return "The photo was taken inside the project area.";
  if (kind === "GPS_MISSING") return "The file carries no GPS position.";
  if (kind === "EXIF_TIMESTAMP_MISSING") return "No capture time could be read from the file.";
  if (kind === "EXIF_TIMESTAMP_IMPLAUSIBLE") return "The time does not fit the project's dates.";
  if (kind === "EXIF_FULLY_STRIPPED") return "Camera, time and location data are absent.";
  if (kind === "CLIENT_HASH_MISMATCH") return "The server's copy differs from the device's.";
  if (kind === "AI_OBSERVATION") return "A note from the advisory AI review.";
  return "See the numbers for the measured values.";
}

const SEVERITY_LABEL = { HIGH: "High", MEDIUM: "Medium", LOW: "Low", INFO: "Information" } as const;

/**
 * FindingCard — three-tier forensic finding disclosure.
 * Authority: docs/19-LAYOUT-SPEC.md §3; docs/18-VISUAL-CORRECTION.md §2.
 *
 * Tier 1 (always): a severity dot and two lines. Collapsed height is 64–80px.
 * Tier 2 ("Show the numbers"): a four-row definition list.
 * Tier 3 ("Show the raw comparison"): why it was flagged, bit grids, images, code.
 */
export function FindingCard({ finding, theme = "field", className }: FindingCardProps) {
  const isPaper = theme === "paper";
  const bodyId = React.useId();

  // Nothing is open on load (docs/18 §3, §4).
  const [showNumbers, setShowNumbers] = React.useState<boolean>(false);
  const [showRaw, setShowRaw] = React.useState<boolean>(false);

  const title = findingKindDisplayMap[finding.kind] ?? finding.kind;
  const { evidence } = finding;

  const dotColour = {
    HIGH: "bg-fraud",
    MEDIUM: "bg-review",
    LOW: "bg-field-muted",
    INFO: "bg-field-muted",
  }[finding.severity];

  const hasBitGrid = Boolean(evidence.beforeHash && evidence.compareHash);
  const hasImages = Boolean(evidence.beforeImageUrl && evidence.matchImageUrl);

  const ink = isPaper ? "text-paper-ink" : "text-field-text";
  const muted = isPaper ? "text-paper-muted" : "text-field-muted";
  const line = isPaper ? "border-paper-rule" : "border-field-hairline";

  const rows: { label: string; value: string; mono: boolean }[] = [
    {
      label:
        evidence.hammingDistance !== undefined
          ? "Perceptual hash distance"
          : evidence.distanceMeters !== undefined
          ? "Distance to boundary"
          : "Measured delta",
      value:
        evidence.hammingDistance !== undefined
          ? `${evidence.hammingDistance} bits`
          : evidence.distanceMeters !== undefined
          ? `${evidence.distanceMeters.toFixed(1)} m`
          : "Recorded",
      mono: true,
    },
    {
      label: "Flagging threshold",
      value:
        evidence.hammingDistance !== undefined
          ? `below ${evidence.threshold}`
          : evidence.toleranceMeters !== undefined
          ? `within ${evidence.toleranceMeters.toFixed(1)} m`
          : "zero tolerance",
      mono: true,
    },
    {
      label: "Match scope",
      value: finding.kind.includes("OTHER_ORG")
        ? "a different organisation"
        : finding.kind.includes("SAME_ORG")
        ? "same organisation, other project"
        : finding.kind.includes("BOUNDARY")
        ? "registered polygon perimeter"
        : "same project plot",
      mono: false,
    },
    { label: "Rule version", value: evidence.ruleVersion || "forensics.v1", mono: true },
  ];

  return (
    <article className={cn("rounded-lg border", isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy", ink, className)}>
      {/* Tier 1: the whole row is the control, so the text keeps the full width of the card */}
      <button
        type="button"
        aria-expanded={showNumbers}
        aria-controls={bodyId}
        onClick={() => setShowNumbers((open) => !open)}
        className={cn(
          "relative flex min-h-16 w-full items-start gap-2 rounded-lg p-4 text-left transition-colors duration-[120ms]",
          isPaper ? "hover:bg-paper" : "hover:bg-field-raised"
        )}
      >
        <span aria-hidden="true" className="flex h-[21px] shrink-0 items-center">
          <span className={cn("size-2 rounded-full", dotColour)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-[21px]">
            <span className="sr-only">{SEVERITY_LABEL[finding.severity]} severity. </span>
            {title}
          </span>
          <span className={cn("mt-1 block pr-6 text-[13px] leading-5", muted)}>{findingSummary(finding)}</span>
        </span>
        {showNumbers ? (
          <ChevronUp aria-hidden="true" className={cn("absolute bottom-4 right-4 size-5", muted)} />
        ) : (
          <ChevronDown aria-hidden="true" className={cn("absolute bottom-4 right-4 size-5", muted)} />
        )}
        <span className="sr-only">{showNumbers ? "Hide the numbers" : "Show the numbers"}</span>
      </button>

      {/* Tier 2: the numbers */}
      {showNumbers && (
        <div id={bodyId} className={cn("space-y-3 border-t p-4 text-[13px] leading-5", line, isPaper ? "bg-paper" : "bg-field-abyss")}>
          <dl className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className={muted}>{row.label}</dt>
                <dd className={cn("text-right", ink, row.mono && "font-mono tabular-nums")}>{row.value}</dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            aria-expanded={showRaw}
            onClick={() => setShowRaw((open) => !open)}
            className={cn("flex h-8 items-center gap-1 transition-colors duration-[120ms] hover:text-field-text", muted)}
          >
            <span>{showRaw ? "Hide the raw comparison" : "Show the raw comparison"}</span>
            {showRaw ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          </button>
        </div>
      )}

      {/* Tier 3: raw artefacts */}
      {showNumbers && showRaw && (
        <div className={cn("space-y-4 border-t p-4 text-[13px] leading-5", line)}>
          <section className="space-y-1">
            <h5 className={ink}>Why it was flagged</h5>
            <p className={cn("prose-column", muted)}>{finding.humanReason}</p>
          </section>

          <div className="flex items-center justify-between gap-4">
            <span className={muted}>Finding code</span>
            <code className="rounded-sm border border-field-hairline bg-field-raised px-2 py-1 font-mono text-[13px] text-field-text">{finding.kind}</code>
          </div>

          {hasBitGrid && (
            <section className="space-y-2">
              <h5 className={ink}>64-bit difference hash</h5>
              <BitGrid
                hash={evidence.beforeHash!}
                compareHash={evidence.compareHash!}
                hammingDistance={evidence.hammingDistance}
                threshold={evidence.threshold}
                label="Candidate submission"
                compareLabel="Matched record"
                theme={theme}
              />
            </section>
          )}

          {hasImages && (
            <section className="space-y-2">
              <h5 className={ink}>Image frames</h5>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { src: evidence.beforeImageUrl!, alt: "Candidate frame", caption: "Candidate frame" },
                  { src: evidence.matchImageUrl!, alt: "Matched record", caption: "Matched record" },
                ].map((frame) => (
                  <figure key={frame.caption} className="space-y-1">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-sm border border-field-hairline bg-field-abyss">
                      <Image src={frame.src} alt={frame.alt} width={400} height={300} unoptimized className="size-full object-cover" />
                    </div>
                    <figcaption className={cn("text-center", muted)}>{frame.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {evidence.matchRef && (
            <section className="space-y-1 rounded-sm border border-field-hairline bg-field-raised p-3">
              <div className="flex items-center justify-between gap-4">
                <span className={muted}>Match reference</span>
                <span className="font-mono tabular-nums text-field-text">{evidence.matchRef}</span>
              </div>
              <p className={cn("prose-column", muted)}>Source organisation identifier is redacted under cross-tenant privacy controls.</p>
            </section>
          )}

          {evidence.exifGps && (
            <div className="flex items-center justify-between gap-4">
              <span className={muted}>GPS coordinate</span>
              <span className="font-mono tabular-nums text-field-text">
                {evidence.exifGps.lat.toFixed(6)}° N, {evidence.exifGps.lng.toFixed(6)}° E
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
