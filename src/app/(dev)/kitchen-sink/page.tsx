"use client";

import * as React from "react";
import Link from "next/link";
import {
  HashDisplay,
  hashDisplayFixtures,
  SeverityChip,
  severityChipFixtures,
  VerificationBadge,
  verificationBadgeFixtures,
  StatusBadge,
  statusBadgeFixtures,
  BitGrid,
  bitGridFixtures,
  QuorumMeter,
  quorumMeterFixtures,
  StepperProgress,
  stepperProgressFixtures,
  SkeletonSet,
  EmptyState,
  emptyStateFixtures,
  OfflineBanner,
  offlineBannerFixtures,
  ProofPreview,
  sampleAnchoredRecord,
  ProjectDrawer,
  FilterPills,
  AtlasShell,
  sampleAtlasProjects,
  QueuePane,
  EvidencePair,
  FindingCard,
  DecisionForm,
  sampleLabSubmissions,
} from "@/src/components";
import SignInPage from "@/src/app/(auth)/sign-in/page";
import SignUpPage from "@/src/app/(auth)/sign-up/page";
import DemoPage from "@/src/app/(auth)/demo/page";
import { cn } from "@/src/lib/utils";

export default function KitchenSinkPage() {
  const [activeTheme, setActiveTheme] = React.useState<"field" | "paper">("field");
  const [sampleFilters, setSampleFilters] = React.useState({
    activityType: "All",
    verificationStatus: "All",
    organization: "All",
  });
  const [isStandaloneDrawerOpen, setIsStandaloneDrawerOpen] = React.useState(false);
  const [activeProjectForDrawer] = React.useState(sampleAtlasProjects[0]);
  const [selectedLabId, setSelectedLabId] = React.useState(sampleLabSubmissions[0].id);
  const [labAdminView, setLabAdminView] = React.useState(true);
  const [labEmptyMode, setLabEmptyMode] = React.useState<"none" | "no-assignments" | "queue-clear">("none");

  const isPaper = activeTheme === "paper";

  return (
    <div
      data-theme={activeTheme}
      className={cn(
        "min-h-screen font-sans transition-colors duration-150",
        isPaper ? "bg-paper text-paper-ink" : "bg-field-abyss text-field-text"
      )}
    >
      {/* Offline Banner Live Demo */}
      <OfflineBanner
        isOffline={true}
        queuedCount={2}
        theme={activeTheme}
        onViewQueue={() => alert("Simulated: Opening offline submission queue drawer")}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header & Theme Control */}
        <header className="mb-10 flex flex-col gap-4 border-b pb-6 border-inherit sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                Delta Design System — Component Kitchen Sink
              </h1>
              <span className="rounded border px-2 py-0.5 text-[11px] tabular-nums text-field-muted bg-field-raised border-field-hairline">
                Lane B · Dev review
              </span>
            </div>
            <p
              className={cn(
                "mt-1 text-xs",
                isPaper ? "text-paper-muted" : "text-field-muted"
              )}
            >
              Pure props-driven UI components tested across all states without database dependencies.
              Obeying docs/06-DESIGN-SYSTEM.md and docs/15-UI-STATES.md.
            </p>
          </div>

          {/* Theme Switcher */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={cn(
                "text-xs text-field-muted",
                isPaper ? "text-paper-muted" : "text-field-muted"
              )}
            >
              Theme:
            </span>
            <div
              className={cn(
                "inline-flex rounded border p-0.5 text-xs font-medium",
                isPaper
                  ? "border-paper-rule bg-paper-card"
                  : "border-field-hairline bg-field-canopy"
              )}
            >
              <button
                type="button"
                onClick={() => setActiveTheme("field")}
                className={cn(
                  "rounded px-3 py-1 transition-colors",
                  !isPaper
                    ? "bg-field-raised text-field-text font-semibold"
                    : "text-paper-muted hover:text-paper-ink"
                )}
              >
                Field (Dark workspace)
              </button>
              <button
                type="button"
                onClick={() => setActiveTheme("paper")}
                className={cn(
                  "rounded px-3 py-1 transition-colors",
                  isPaper
                    ? "bg-[#EFE9DC] text-paper-ink font-semibold"
                    : "text-field-muted hover:text-field-text"
                )}
              >
                Paper (Warm dossier)
              </button>
            </div>
          </div>
        </header>

        {/* Quick Jump Navigation */}
        <nav
          className={cn(
            "mb-8 flex flex-wrap gap-2 border-b pb-4 text-xs border-inherit",
            isPaper ? "text-paper-muted" : "text-field-muted"
          )}
        >
          <a href="#tokens" className="hover:underline">1. Tokens</a>
          <span>·</span>
          <a href="#hash-display" className="hover:underline">2. Hash display</a>
          <span>·</span>
          <a href="#severity-chip" className="hover:underline">3. Severity chip</a>
          <span>·</span>
          <a href="#verification-badge" className="hover:underline">4. Verification badge</a>
          <span>·</span>
          <a href="#status-badge" className="hover:underline">5. Status badge</a>
          <span>·</span>
          <a href="#bit-grid" className="hover:underline">6. Bit grid</a>
          <span>·</span>
          <a href="#quorum-meter" className="hover:underline">7. Quorum meter</a>
          <span>·</span>
          <a href="#stepper-progress" className="hover:underline">8. Stepper progress</a>
          <span>·</span>
          <a href="#skeletons" className="hover:underline">9. Skeletons</a>
          <span>·</span>
          <a href="#empty-state" className="hover:underline">10. Empty state</a>
          <span>·</span>
          <a href="#offline-banner" className="hover:underline">11. Offline banner</a>
          <span>·</span>
          <a href="#auth-surfaces" className="hover:underline">12. Auth surfaces</a>
          <span>·</span>
          <a href="#atlas-surfaces" className="hover:underline text-field-text font-medium">13. Atlas &amp; public project</a>
          <span>·</span>
          <a href="#lab-surfaces" className="hover:underline text-field-text font-medium">14. Evidence Lab</a>
        </nav>

        <div className="space-y-12">
          {/* SECTION 1: DESIGN TOKENS SWATCHES */}
          <section id="tokens" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                1. Design tokens and contrast floor
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Surface value shifts replace shadows. Mid-tone greens (--verified, --paper-seal) are strictly fill/border/icon colours, never body text (WCAG AA).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 text-xs font-mono">
              <div className="rounded border p-3 bg-field-abyss text-field-text border-field-hairline">
                <div className="font-semibold">--field-abyss</div>
                <div className="text-[11px] text-field-muted">#0A0C0B</div>
                <div className="mt-1 text-[10px] text-field-inert">Page bg</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-field-text border-field-hairline">
                <div className="font-semibold">--field-canopy</div>
                <div className="text-[11px] text-field-muted">#121514</div>
                <div className="mt-1 text-[10px] text-field-inert">Cards, panels</div>
              </div>
              <div className="rounded border p-3 bg-field-raised text-field-text border-field-hairline">
                <div className="font-semibold">--field-raised</div>
                <div className="text-[11px] text-field-muted">#1A1E1C</div>
                <div className="mt-1 text-[10px] text-field-inert">Hover, inputs</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy border-field-hairline text-signal">
                <div className="font-semibold">--signal</div>
                <div className="text-[11px]">#C9F578</div>
                <div className="mt-1 text-[10px] text-field-muted">1 action/screen</div>
              </div>
              <div className="rounded border p-3 bg-verified text-[#0A0C0B] border-verified">
                <div className="font-semibold">--verified (fill)</div>
                <div className="text-[11px]">#3DD6B0</div>
                <div className="mt-1 text-[10px]">Text: #0A0C0B</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-chain border-field-hairline">
                <div className="font-semibold">--chain</div>
                <div className="text-[11px]">#8B93FF</div>
                <div className="mt-1 text-[10px] text-field-muted">Base Sepolia</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-review border-field-hairline">
                <div className="font-semibold">--review</div>
                <div className="text-[11px]">#F0A93B</div>
                <div className="mt-1 text-[10px] text-field-muted">Human eye needed</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-fraud border-field-hairline">
                <div className="font-semibold">--fraud</div>
                <div className="text-[11px]">#F2705C</div>
                <div className="mt-1 text-[10px] text-field-muted">High severity</div>
              </div>
              <div className="rounded border p-3 bg-paper text-paper-ink border-paper-rule">
                <div className="font-semibold">--paper</div>
                <div className="text-[11px] text-paper-muted">#F7F3EA</div>
                <div className="mt-1 text-[10px] text-paper-muted">Warm certificate</div>
              </div>
              <div className="rounded border p-3 bg-paper-card text-paper-ink border-paper-rule">
                <div className="font-semibold">--paper-card</div>
                <div className="text-[11px] text-paper-muted">#FFFDF8</div>
                <div className="mt-1 text-[10px] text-paper-muted">Raised dossier</div>
              </div>
              <div className="rounded border p-3 bg-paper-seal text-white border-paper-seal">
                <div className="font-semibold">--paper-seal</div>
                <div className="text-[11px]">#1F6B55</div>
                <div className="mt-1 text-[10px]">Fill/icon only</div>
              </div>
              <div className="rounded border p-3 bg-paper-card text-paper-chain border-paper-rule">
                <div className="font-semibold">--paper-chain</div>
                <div className="text-[11px]">#4A4FA8</div>
                <div className="mt-1 text-[10px] text-paper-muted">Paper on-chain</div>
              </div>
            </div>
          </section>

          {/* SECTION 2: HASHDISPLAY */}
          <section id="hash-display" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                2. Hash display
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Full 64 characters in dossier/lab; truncated strictly as 8…8 with hover &amp; copy in lists.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={cn(
                  "rounded-lg border p-4 space-y-3",
                  isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
                )}
              >
                <div className="text-xs font-semibold">Full 64-char Cryptographic Digest</div>
                <HashDisplay {...hashDisplayFixtures.fullSha256} theme={activeTheme} />
                <div className="text-xs font-semibold pt-2">Full Merkle Root</div>
                <HashDisplay {...hashDisplayFixtures.fullMerkleRoot} theme={activeTheme} />
              </div>

              <div
                className={cn(
                  "rounded-lg border p-4 space-y-3",
                  isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
                )}
              >
                <div className="text-xs font-semibold">Truncated List Variant (8…8) with Copy</div>
                <div className="flex flex-col gap-2">
                  <HashDisplay {...hashDisplayFixtures.truncatedSha256} theme={activeTheme} />
                  <HashDisplay
                    hash="7c8cf8e2644f3e9d80d7f6b814201e0c14131c2b28273a36e8ede98ca39c5b6d"
                    variant="truncated"
                    label="manifest"
                    theme={activeTheme}
                  />
                  <HashDisplay {...hashDisplayFixtures.noCopyButton} theme={activeTheme} />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: SEVERITYCHIP */}
          <section id="severity-chip" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                3. Severity chip
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Shape + label + color encoding (never color alone). Sentence case.
              </p>
            </div>

            <div
              className={cn(
                "rounded-lg border p-4 space-y-4",
                isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <SeverityChip {...severityChipFixtures.infoField} theme={activeTheme} />
                <SeverityChip {...severityChipFixtures.lowField} theme={activeTheme} />
                <SeverityChip {...severityChipFixtures.mediumField} theme={activeTheme} />
                <SeverityChip {...severityChipFixtures.highField} theme={activeTheme} />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-inherit">
                <span className="text-xs text-field-muted">From fixtures with counts:</span>
                <SeverityChip {...severityChipFixtures.mediumWithCount} theme={activeTheme} />
                <SeverityChip {...severityChipFixtures.highWithCount} theme={activeTheme} />
                <SeverityChip severity="info" count={5} label="Metadata note" theme={activeTheme} />
              </div>
            </div>
          </section>

          {/* SECTION 4: VERIFICATIONBADGE */}
          <section id="verification-badge" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                4. Verification badge
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Four states: Match, Mismatch, Pending, Unavailable. Unreachable RPC is neutral grey (never a false red mismatch).
              </p>
            </div>

            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border p-4",
                isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
              )}
            >
              <div className="space-y-1">
                <span className="text-[11px] text-field-muted block">1. Confirmed match:</span>
                <VerificationBadge {...verificationBadgeFixtures.matchFieldWithDetail} theme={activeTheme} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-field-muted block">2. Tamper mismatch:</span>
                <VerificationBadge {...verificationBadgeFixtures.mismatchField} theme={activeTheme} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-field-muted block">3. Pending on-chain:</span>
                <VerificationBadge {...verificationBadgeFixtures.pendingField} theme={activeTheme} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-field-muted block">4. RPC unavailable:</span>
                <VerificationBadge {...verificationBadgeFixtures.unavailableField} theme={activeTheme} />
              </div>
            </div>
          </section>

          {/* SECTION 5: STATUSBADGE */}
          <section id="status-badge" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                5. Status badge
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Full workflow lifecycle including Escalated (split decision awaiting verifier admin deciding vote).
              </p>
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center gap-2.5 rounded-lg border p-4",
                isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
              )}
            >
              <StatusBadge {...statusBadgeFixtures.draft} theme={activeTheme} />
              <StatusBadge {...statusBadgeFixtures.pendingForensics} theme={activeTheme} />
              <StatusBadge {...statusBadgeFixtures.inReview} theme={activeTheme} />
              <StatusBadge {...statusBadgeFixtures.needsMoreProof} theme={activeTheme} />
              <StatusBadge {...statusBadgeFixtures.escalated} theme={activeTheme} />
              <StatusBadge {...statusBadgeFixtures.approved} theme={activeTheme} />
              <StatusBadge {...statusBadgeFixtures.anchored} theme={activeTheme} />
              <StatusBadge {...statusBadgeFixtures.rejected} theme={activeTheme} />
            </div>
          </section>

          {/* SECTION 6: BITGRID */}
          <section id="bit-grid" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                6. Bit grid
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                8×8 matrix visualizer for 64-bit dHash perceptual hashing. Differing bits highlighted with Hamming distance calculation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BitGrid {...bitGridFixtures.nearDuplicateComparison} theme={activeTheme} />
              <BitGrid {...bitGridFixtures.distinctComparison} theme={activeTheme} />
            </div>
          </section>

          {/* SECTION 7: QUORUMMETER */}
          <section id="quorum-meter" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                7. Quorum meter
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Anonymous vote pips. Rule: Count only — never who voted. Supports 2 approvals, 2 rejections, or escalated split.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuorumMeter {...quorumMeterFixtures.zeroVotes} theme={activeTheme} />
              <QuorumMeter {...quorumMeterFixtures.oneApproval} theme={activeTheme} />
              <QuorumMeter {...quorumMeterFixtures.quorumSatisfied} theme={activeTheme} />
              <QuorumMeter {...quorumMeterFixtures.escalatedSplit} theme={activeTheme} />
            </div>
          </section>

          {/* SECTION 8: STEPPERPROGRESS */}
          <section id="stepper-progress" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                8. Stepper progress
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Honest discrete stages during 5–20s forensic pipeline. No synthetic percentage bars. Inline values for completed stages.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StepperProgress {...stepperProgressFixtures.inFlight} theme={activeTheme} />
              <StepperProgress {...stepperProgressFixtures.duplicateDetected} theme={activeTheme} />
            </div>
          </section>

          {/* SECTION 9: SKELETONS */}
          <section id="skeletons" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                9. Skeletons
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Surface --field-raised, NO shimmer animation. Exact content dimensions prevent reflow when streaming data resolves.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-xs text-field-muted">/lab Review queue skeleton:</span>
                <SkeletonSet.LabQueue theme={activeTheme} />
              </div>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-field-muted">Findings pane skeleton:</span>
                  <SkeletonSet.FindingsPane theme={activeTheme} className="mt-1" />
                </div>
                <div>
                  <span className="text-xs text-field-muted">64-char hash skeleton (zero shift):</span>
                  <div className="mt-1">
                    <SkeletonSet.Hash theme={activeTheme} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-xs text-field-muted">Evidence side-by-side 4:3 skeleton:</span>
              <SkeletonSet.EvidencePane theme={activeTheme} />
            </div>
          </section>

          {/* SECTION 10: EMPTYSTATE */}
          <section id="empty-state" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                10. Empty state
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Three-part structure: What this space is for, Why it is empty right now, One action or honest statement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <EmptyState {...emptyStateFixtures.labNoAssignments} theme={activeTheme} />
              <EmptyState {...emptyStateFixtures.labQueueClear} theme={activeTheme} />
              <EmptyState {...emptyStateFixtures.labFiltered} theme={activeTheme} />
              <EmptyState {...emptyStateFixtures.dashboardNoProjects} theme={activeTheme} />
              <EmptyState {...emptyStateFixtures.projectNoSubmissions} theme={activeTheme} />
              <EmptyState {...emptyStateFixtures.findingsNone} theme={activeTheme} />
            </div>
          </section>

          {/* SECTION 11: OFFLINEBANNER */}
          <section id="offline-banner" className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-field-text">
                11. Offline banner
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Persistent status bar below header. Offline is an operational mode, not an error.
              </p>
            </div>

            <div
              className={cn(
                "space-y-3 rounded-lg border p-4",
                isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
              )}
            >
              <div>
                <span className="text-[11px] text-field-muted block mb-1">State: Offline with 2 queued submissions:</span>
                <OfflineBanner {...offlineBannerFixtures.offlineWithQueue} theme={activeTheme} />
              </div>

              <div>
                <span className="text-[11px] text-field-muted block mb-1">State: Offline, queue empty (IndexedDB standby):</span>
                <OfflineBanner {...offlineBannerFixtures.offlineZeroQueue} theme={activeTheme} />
              </div>

              <div>
                <span className="text-[11px] text-field-muted block mb-1">State: Reconnected, actively syncing queue:</span>
                <OfflineBanner {...offlineBannerFixtures.syncingQueue} theme={activeTheme} />
              </div>
            </div>
          </section>

          {/* SECTION 12: AUTH SURFACES */}
          <section id="auth-surfaces" className="space-y-6 pt-6 border-t border-inherit">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-field-text">
                  12. Authentication and onboarding surfaces
                </h2>
                <span className="rounded border px-2 py-0.5 text-[10px] text-field-muted bg-field-raised border-field-hairline">
                  45/55 asymmetric split
                </span>
              </div>
              <p
                className={cn(
                  "text-xs mt-1",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                No glowing orbs or centered gradient cards. Real anchored proof preview on left; focused forms on right.
              </p>
            </div>

            {/* Direct Page Links */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs text-field-text hover:border-field-muted transition-colors"
              >
                <span>Route: /sign-in</span>
                <span className="text-field-muted">→</span>
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs text-field-text hover:border-field-muted transition-colors"
              >
                <span>Route: /sign-up (2 steps)</span>
                <span className="text-field-muted">→</span>
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs text-field-text hover:border-field-muted transition-colors"
              >
                <span>Route: /demo (4 roles)</span>
                <span className="text-field-muted">→</span>
              </Link>
            </div>

            {/* ProofPreview Component (Desktop & Collapsed) */}
            <div className="space-y-3">
              <span className="text-xs text-field-muted block">
                Proof preview artifact (left 45% panel and collapsed mobile bar):
              </span>
              <div className="rounded-lg border border-field-hairline overflow-hidden">
                <ProofPreview record={sampleAnchoredRecord} mode="collapsed" />
                <div className="hidden md:block bg-field-canopy border-t border-field-hairline">
                  <ProofPreview record={sampleAnchoredRecord} mode="full" />
                </div>
              </div>
            </div>

            {/* Live Interactive Embeds */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Sign In Form Embed */}
              <div className="rounded-lg border border-field-hairline bg-field-abyss p-6">
                <span className="text-xs text-field-muted block mb-3 font-medium">
                  Embedded sign-in view:
                </span>
                <SignInPage />
              </div>

              {/* Demo Persona Switcher Embed */}
              <div className="rounded-lg border border-field-hairline bg-field-abyss p-6">
                <span className="text-xs text-field-muted block mb-3 font-medium">
                  Embedded demo switcher view:
                </span>
                <DemoPage onSelectPersona={(p) => alert(`Selected persona: ${p.roleTitle} (${p.organization})`)} />
              </div>
            </div>

            {/* Sign Up Two-Step Form Embed */}
            <div className="rounded-lg border border-field-hairline bg-field-abyss p-6 max-w-xl">
              <span className="text-xs text-field-muted block mb-3 font-medium">
                Embedded sign-up view (Step 1 + Step 2 type cards):
              </span>
              <SignUpPage />
            </div>
          </section>

          {/* SECTION 13: ATLAS & PUBLIC PROJECT SURFACES */}
          <section id="atlas-surfaces" className="space-y-6 pt-6 border-t border-inherit">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-field-text">
                  13. Atlas and public project surfaces
                </h2>
                <span className="rounded border px-2 py-0.5 text-[10px] text-field-muted bg-field-raised border-field-hairline">
                  Stage 3 preview
                </span>
              </div>
              <p
                className={cn(
                  "text-xs mt-1",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Cartographic shell with overlaid controls, instant client-side filter pills, slide-over drawer, claimed-vs-verified gap, and Empty States E1 and E2.
              </p>
            </div>

            {/* Direct Route Links */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/p/sundarbans-corridor"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs text-field-text hover:border-field-muted transition-colors"
              >
                <span>Route: /p/sundarbans-corridor (Verified record)</span>
                <span className="text-field-muted">→</span>
              </Link>
              <Link
                href="/p/sylhet-reforestation"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs text-field-text hover:border-field-muted transition-colors"
              >
                <span>Route: /p/sylhet-reforestation (Pending quorum)</span>
                <span className="text-field-muted">→</span>
              </Link>
              <Link
                href="/p/empty"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs text-field-text hover:border-field-muted transition-colors"
              >
                <span>Route: /p/empty (Empty state E2: No proofs)</span>
                <span className="text-field-muted">→</span>
              </Link>
            </div>

            {/* Standalone FilterPills Demo */}
            <div
              className={cn(
                "rounded-lg border p-4 space-y-3",
                isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
              )}
            >
              <span className="text-xs text-field-muted block font-medium">
                FilterPills component (standalone interactive pill bar):
              </span>
              <FilterPills
                filters={sampleFilters}
                onFilterChange={setSampleFilters}
                matchCount={3}
                totalCount={4}
                theme={activeTheme}
              />
              <div className="font-mono text-[11px] text-field-muted">
                Active Filter State: {JSON.stringify(sampleFilters)}
              </div>
            </div>

            {/* Standalone ProjectDrawer Trigger */}
            <div
              className={cn(
                "rounded-lg border p-4 space-y-3",
                isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-field-muted block font-medium">
                    ProjectDrawer component (slide-over on desktop, bottom sheet on mobile):
                  </span>
                  <span className="text-xs font-medium">
                    Testing with: {activeProjectForDrawer.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStandaloneDrawerOpen(true)}
                  className="rounded bg-field-raised border border-field-hairline px-3 py-1.5 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors"
                >
                  Open Standalone Drawer →
                </button>
              </div>

              <ProjectDrawer
                project={activeProjectForDrawer}
                isOpen={isStandaloneDrawerOpen}
                onClose={() => setIsStandaloneDrawerOpen(false)}
                theme={activeTheme}
              />
            </div>

            {/* Full-Bleed AtlasShell Embedded Container */}
            <div className="space-y-2">
              <span className="text-xs text-field-muted block font-medium">
                AtlasShell component (full-bleed map layout stub with centroids, top overlays and drawer):
              </span>
              <div className="h-[520px] w-full rounded-xl border border-field-hairline overflow-hidden relative">
                <AtlasShell
                  projects={sampleAtlasProjects}
                  theme={activeTheme}
                  initialSelectedSlug="sundarbans-corridor"
                />
              </div>
            </div>
          </section>

          {/* 14. Evidence Lab Surfaces */}
          <section id="lab-surfaces" className="space-y-6">
            <div className="border-b border-inherit pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-field-text">
                  14. Evidence Lab surfaces
                </h2>
                <p className="text-xs text-field-muted mt-1">
                  Three-pane verification workspace: severity-sorted queue, synchronized evidence comparison slider, literal forensic drawer, and consensus decision form.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/lab"
                  className="rounded bg-signal px-3 py-1.5 text-xs font-semibold text-[#0A0C0B] hover:bg-signal/90 transition-colors flex items-center gap-1.5"
                >
                  Open full-screen /lab workspace →
                </Link>
              </div>
            </div>

            {/* Embedded 3-Pane Mini Lab Preview */}
            <div className="rounded-xl border border-field-hairline bg-field-canopy overflow-hidden">
              {/* Lab Preview Top Bar */}
              <div className="p-3 border-b border-field-hairline bg-field-raised flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-field-text">Lab sub-surface interactive testbed</span>
                  <span className="text-field-muted">·</span>
                  <span className="text-field-muted">Selected ID: {selectedLabId.slice(0, 16)}…</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Admin View Toggle */}
                  <button
                    type="button"
                    onClick={() => setLabAdminView(!labAdminView)}
                    className={cn(
                      "px-2 py-0.5 rounded border text-[11px] transition-colors",
                      labAdminView
                        ? "bg-chain/15 text-chain border-chain/40 font-medium"
                        : "border-field-hairline text-field-muted hover:text-field-text"
                    )}
                  >
                    Admin pinning: {labAdminView ? "Enabled" : "Disabled"}
                  </button>

                  {/* Empty State Selector */}
                  <div className="flex items-center rounded border border-field-hairline p-0.5 bg-field-canopy text-[10px]">
                    <button
                      type="button"
                      onClick={() => setLabEmptyMode("none")}
                      className={cn(
                        "px-1.5 py-0.5 rounded transition-colors",
                        labEmptyMode === "none" ? "bg-field-raised text-field-text font-medium" : "text-field-muted"
                      )}
                    >
                      Queue
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabEmptyMode("no-assignments")}
                      className={cn(
                        "px-1.5 py-0.5 rounded transition-colors",
                        labEmptyMode === "no-assignments" ? "bg-field-raised text-field-text font-medium" : "text-field-muted"
                      )}
                    >
                      E5
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabEmptyMode("queue-clear")}
                      className={cn(
                        "px-1.5 py-0.5 rounded transition-colors",
                        labEmptyMode === "queue-clear" ? "bg-field-raised text-field-text font-medium" : "text-field-muted"
                      )}
                    >
                      E5b
                    </button>
                  </div>
                </div>
              </div>

              {/* 3-Pane Layout Preview Container */}
              <div className="flex flex-col lg:flex-row h-[760px] overflow-hidden">
                {/* 1. Queue Pane */}
                <QueuePane
                  submissions={sampleLabSubmissions}
                  selectedId={selectedLabId}
                  onSelect={(id) => setSelectedLabId(id)}
                  isVerifierAdmin={labAdminView}
                  emptyStateMode={labEmptyMode}
                  theme={activeTheme}
                  className="w-full lg:w-[300px]"
                />

                {labEmptyMode === "none" ? (
                  <>
                    {/* 2. Evidence Viewport */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r border-field-hairline bg-field-abyss">
                      {(() => {
                        const active =
                          sampleLabSubmissions.find((s) => s.id === selectedLabId) ??
                          sampleLabSubmissions[0];
                        return (
                          <>
                            <EvidencePair
                              before={active.beforeImage}
                              after={active.afterImage}
                              theme={activeTheme}
                            />

                            <div className="rounded-lg border border-field-hairline bg-field-canopy p-3 space-y-2 text-xs">
                              <span className="font-medium text-field-text text-[11px] block">
                                Submission EXIF and boundary telemetry
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-field-muted">
                                <div>GPS: {active.exif.gps ? `${active.exif.gps.lat.toFixed(4)}° N, ${active.exif.gps.lng.toFixed(4)}° E` : "None"}</div>
                                <div>Containment: {active.exif.insideBoundary ? "Inside polygon" : "Outside"}</div>
                                <div>Camera: {active.exif.cameraModel ?? "Sensor"}</div>
                                <div>Capture: {active.afterImage.capturedAt}</div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* 3. Findings & Decision Pane */}
                    <div className="w-full lg:w-[360px] overflow-y-auto p-4 space-y-4 bg-field-canopy">
                      {(() => {
                        const active =
                          sampleLabSubmissions.find((s) => s.id === selectedLabId) ??
                          sampleLabSubmissions[0];
                        return (
                          <>
                            <div className="space-y-3">
                              <span className="text-xs font-medium text-field-muted block">
                                Forensic findings ({active.findings.length})
                              </span>
                              {active.findings.length === 0 ? (
                                <div className="rounded-lg border border-field-hairline bg-field-raised p-3 text-xs text-field-muted">
                                  No findings — all 7 checks completed.
                                </div>
                              ) : (
                                active.findings.map((f) => (
                                  <FindingCard key={f.id} finding={f} theme={activeTheme} />
                                ))
                              )}
                            </div>

                            <div className="pt-2 border-t border-field-hairline">
                              <DecisionForm
                                submissionId={active.id}
                                approvalsCount={active.approvalsCount}
                                rejectionsCount={active.rejectionsCount}
                                requiredQuorum={active.requiredQuorum}
                                isEscalated={active.isEscalated || active.status === "ESCALATED"}
                                userHasDecided={active.userHasDecided}
                                userDecision={active.userDecision}
                                onSubmitDecision={(payload) => {
                                  alert(`Recorded decision for ${active.id}: ${payload.action} ("${payload.reason}")`);
                                }}
                                theme={activeTheme}
                              />
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 bg-field-abyss">
                    <EmptyState
                      title={labEmptyMode === "no-assignments" ? "Your review queue" : "Queue clear"}
                      reason={
                        labEmptyMode === "no-assignments"
                          ? "Your organisation is not assigned to any projects yet. A platform administrator assigns verifier organisations to the projects they audit."
                          : "Nothing is awaiting your review. New submissions appear here automatically once forensic processing completes."
                      }
                      honestNote={labEmptyMode === "no-assignments" ? "Cannot be resolved by user. Platform admin assigns audit lanes." : "Last reviewed 14m ago."}
                      action={
                        labEmptyMode === "no-assignments"
                          ? {
                              label: "Contact Support",
                              onClick: () => alert("Support contact triggered"),
                            }
                          : undefined
                      }
                      theme={activeTheme}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
