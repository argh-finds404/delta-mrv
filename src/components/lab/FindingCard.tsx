"use client";

import * as React from "react";
import Image from "next/image";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
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
  SATELLITE_NDVI: "Satellite vegetation cross-check",
  CLAIM_CHECKED: "The claim against the drawn boundary",
  CLAIM_EXCEEDS_AREA: "Claims more area than the boundary holds",
  CLAIM_DENSITY_IMPLAUSIBLE: "More plants per square metre than any method",
  CONTENT_CREDENTIALS: "Content Credentials (C2PA)",
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
  if (kind === "SATELLITE_NDVI" && evidence.ndvi) {
    const { baseline, current, delta } = evidence.ndvi;
    if (baseline && current && delta !== undefined) return `NDVI ${baseline.ndvi.toFixed(2)} to ${current.ndvi.toFixed(2)} (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}).`;
    return "Inconclusive: no clean satellite comparison.";
  }
  const claim = evidence.claim;
  if (kind === "CLAIM_EXCEEDS_AREA" && claim?.ratio !== undefined) return `The claim is ${claim.ratio.toFixed(1)}× the area drawn.`;
  if (kind === "CLAIM_DENSITY_IMPLAUSIBLE" && claim?.perSquareMetre !== undefined) return `${claim.perSquareMetre.toLocaleString("en-GB", { maximumFractionDigits: 1 })} per m², above ${claim.maxPerSquareMetre ?? 5}.`;
  if (kind === "CLAIM_CHECKED" && claim?.perHectare !== undefined) return `About ${claim.perHectare.toLocaleString("en-GB")} per hectare.`;
  if (kind === "CLAIM_CHECKED") return "The claimed area fits the boundary.";
  if (kind === "CONTENT_CREDENTIALS") {
    if (evidence.c2pa?.outcome === "valid") return "Signed C2PA manifest; signature verified.";
    if (evidence.c2pa?.outcome === "invalid") return "C2PA manifest present; signature failed.";
    return "No C2PA Content Credentials in the file.";
  }
  return "See the numbers for the measured values.";
}

const SEVERITY_LABEL = { HIGH: "High", MEDIUM: "Medium", LOW: "Low", INFO: "Information" } as const;
const RESOLUTION = { CONFIRMED: "An operator confirmed it is a reuse", CLEARED: "An operator cleared it: not a reuse" } as const;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A match reference, with a one-click copy so it reaches /admin without a typo. */
function MatchRef({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="break-all font-mono tabular-nums text-field-text">{value}</span>
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => setCopied(false),
          )
        }
        aria-label={copied ? "Match reference copied" : "Copy the match reference"}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-field-hairline px-2 text-[12px] text-field-muted transition-colors hover:text-field-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy ref"}
      </button>
    </span>
  );
}

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

  const scene = (s: { ndvi: number; datetime: string; cloudCover: number; clear: number; pixels: number }) =>
    `${s.ndvi.toFixed(3)} · ${new Date(s.datetime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · ${s.cloudCover.toFixed(1)}% cloud · ${s.clear} of ${s.pixels} pixels clear`;
  const ndviRows = evidence.ndvi
    ? evidence.ndvi.baseline && evidence.ndvi.current && evidence.ndvi.delta !== undefined
      ? [
          { label: "Before", value: scene(evidence.ndvi.baseline), mono: true },
          { label: "After", value: scene(evidence.ndvi.current), mono: true },
          { label: "Change", value: `${evidence.ndvi.delta >= 0 ? "+" : ""}${evidence.ndvi.delta.toFixed(3)} NDVI`, mono: true },
          { label: "Scenes", value: `${evidence.ndvi.baseline.sceneId}, ${evidence.ndvi.current.sceneId}`, mono: true },
          { label: "Rule version", value: evidence.ruleVersion || "ndvi.v1", mono: true },
        ]
      : [
          { label: "Result", value: "Inconclusive", mono: false },
          { label: "Why", value: evidence.ndvi.reason ?? "No clean comparison", mono: false },
          { label: "Rule version", value: evidence.ruleVersion || "ndvi.v1", mono: true },
        ]
    : null;

  const c = evidence.claim;
  const ha = (m2?: number) => (m2 === undefined ? "Not recorded" : `${(m2 / 10_000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} ha`);
  const claimRows = c
    ? [
        { label: "Boundary area", value: ha(c.boundaryAreaM2), mono: true },
        ...(c.plants !== undefined
          ? [
              { label: "Claimed", value: `${c.plants.toLocaleString("en-GB")} ${c.unit ?? ""}`.trim(), mono: true },
              { label: "Density", value: `${(c.perHectare ?? 0).toLocaleString("en-GB")} per ha, ${c.perSquareMetre ?? 0} per m²`, mono: true },
              { label: "Flagged above", value: `${c.maxPerSquareMetre ?? 5} per m²`, mono: true },
            ]
          : [
              { label: "Claimed", value: `${c.claimed ?? ""} ${c.unit ?? ""}`.trim(), mono: true },
              { label: "Claim ÷ boundary", value: `${c.ratio ?? "?"}×`, mono: true },
              { label: "Flagged above", value: `${c.tolerance ?? 1.05}×`, mono: true },
            ]),
        { label: "Rule version", value: evidence.ruleVersion || "claims.v1", mono: true },
      ]
    : null;

  const c2paRows = evidence.c2pa
    ? evidence.c2pa.outcome === "absent"
      ? [
          { label: "Manifest", value: "None embedded", mono: false },
          { label: "Rule version", value: evidence.ruleVersion || "c2pa.v1", mono: true },
        ]
      : [
          { label: "Status", value: evidence.c2pa.outcome === "valid" ? "Signature and data hash verified" : "Verification failed", mono: false },
          { label: "Signer", value: evidence.c2pa.signer ?? evidence.c2pa.issuer ?? "Not recorded", mono: false },
          ...(evidence.c2pa.claimGenerator ? [{ label: "Generator", value: evidence.c2pa.claimGenerator, mono: true }] : []),
          ...(evidence.c2pa.signedAt ? [{ label: "Signed at", value: evidence.c2pa.signedAt, mono: true }] : []),
          ...(evidence.c2pa.failureCodes?.length ? [{ label: "Failure code", value: evidence.c2pa.failureCodes.join(", "), mono: true }] : []),
          { label: "Rule version", value: evidence.ruleVersion || "c2pa.v1", mono: true },
        ]
    : null;

  const rows: { label: string; value: string; mono: boolean }[] = ndviRows ?? claimRows ?? c2paRows ?? [
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
          <span className={cn("mt-1 block pr-6 text-[13px] leading-5", muted)}>
            {finding.subject && <span className={ink}>{finding.subject}. </span>}
            {findingSummary(finding)}
          </span>
          {finding.resolution && (
            <span className={cn("mt-1.5 block pr-6 text-[13px] font-medium leading-5", finding.resolution.outcome === "CONFIRMED" ? "text-fraud" : "text-verified")} data-testid="finding-resolution">
              {RESOLUTION[finding.resolution.outcome]}, {day(finding.resolution.at)}
            </span>
          )}
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

          {evidence.ndvi?.seasonal && evidence.ndvi.current && <SeasonChart seasonal={evidence.ndvi.seasonal} current={evidence.ndvi.current} theme={theme} />}

          {finding.resolution && (
            <div className="space-y-1 rounded-sm border border-field-hairline bg-field-raised p-3">
              <p className={ink}>
                {RESOLUTION[finding.resolution.outcome]} on {day(finding.resolution.at)} UTC
              </p>
              <p className={cn("prose-column", muted)}>{finding.resolution.reason}</p>
            </div>
          )}
          {evidence.matchRef && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className={muted}>Match reference</span>
              <MatchRef value={evidence.matchRef} />
            </div>
          )}

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

          {evidence.telemetry !== undefined && (
            <section className="space-y-1">
              <h5 className={ink}>What the satellite archive returned</h5>
              <pre className="max-h-64 overflow-auto rounded-sm border border-field-hairline bg-field-raised p-3 font-mono text-[12px] leading-[1.5] text-field-text">{JSON.stringify(evidence.telemetry, null, 2).slice(0, 4000)}</pre>
            </section>
          )}

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
            <p className={cn("prose-column", muted)}>
              Whose photo it matches is not shown here. A Delta operator can trace the match reference and record whether it is a reuse; that conclusion then appears on this card.
            </p>
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

/**
 * The current NDVI against the same season in earlier years: one dot per year, the median as a
 * dashed line, this season as the filled dot. Every value is also in the text beside it.
 */
function SeasonChart({ seasonal, current, theme }: { seasonal: NonNullable<NonNullable<LabFinding["evidence"]["ndvi"]>["seasonal"]>; current: { ndvi: number; datetime: string }; theme: "field" | "paper" }) {
  const points = [...seasonal.years.map((y) => ({ year: y.year, ndvi: y.ndvi, now: false })), { year: new Date(current.datetime).getUTCFullYear(), ndvi: current.ndvi, now: true }];
  if (points.length < 2) return null;
  const [W, H, PAD] = [280, 72, 14];
  const values = points.map((p) => p.ndvi);
  const lo = Math.min(...values, seasonal.median ?? Infinity) - 0.05;
  const hi = Math.max(...values, seasonal.median ?? -Infinity) + 0.05;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (points.length - 1);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo || 1)) * (H - 2 * PAD);
  const muted = theme === "paper" ? "text-paper-muted" : "text-field-muted";
  const summary = `NDVI in the same season: ${seasonal.years.map((s) => `${s.year} ${s.ndvi.toFixed(2)}`).join(", ")}; this season ${current.ndvi.toFixed(2)}${seasonal.median !== null ? `, median of earlier years ${seasonal.median.toFixed(2)}` : ""}.`;
  return (
    <figure className="space-y-1.5" data-testid="season-chart">
      <figcaption className={muted}>
        Same season, earlier years
        {seasonal.anomaly !== null && (
          <span className="ml-1 font-mono tabular-nums">
            · this season {seasonal.anomaly >= 0 ? "+" : ""}
            {seasonal.anomaly.toFixed(2)} against the median
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-[72px] w-full max-w-[320px] overflow-visible">
        {seasonal.median !== null && <line x1={PAD} x2={W - PAD} y1={y(seasonal.median)} y2={y(seasonal.median)} stroke="currentColor" strokeDasharray="3 3" className={muted} />}
        <polyline points={points.map((p, i) => `${x(i)},${y(p.ndvi)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1} className={muted} />
        {points.map((p, i) => (
          <g key={p.year}>
            <circle cx={x(i)} cy={y(p.ndvi)} r={p.now ? 4.5 : 3} className={p.now ? "fill-verified" : "fill-current"} />
            <text x={x(i)} y={H} textAnchor="middle" className={cn("fill-current text-[10px]", muted)}>
              {p.year}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
