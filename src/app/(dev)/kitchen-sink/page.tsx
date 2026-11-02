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
} from "@/src/components";
import SignInPage from "@/src/app/(auth)/sign-in/page";
import SignUpPage from "@/src/app/(auth)/sign-up/page";
import DemoPage from "@/src/app/(auth)/demo/page";
import { cn } from "@/lib/utils";

export default function KitchenSinkPage() {
  const [activeTheme, setActiveTheme] = React.useState<"field" | "paper">("field");

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
              <span className="rounded border px-2 py-0.5 font-mono text-[11px] tabular-nums text-signal bg-field-raised border-field-hairline">
                Lane B · Dev Review
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
                "text-xs font-mono uppercase tracking-wider",
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
                Field (Dark Workspace)
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
                Paper (Warm Dossier)
              </button>
            </div>
          </div>
        </header>

        {/* Quick Jump Navigation */}
        <nav
          className={cn(
            "mb-8 flex flex-wrap gap-2 border-b pb-4 text-xs font-mono border-inherit",
            isPaper ? "text-paper-muted" : "text-field-muted"
          )}
        >
          <a href="#tokens" className="hover:underline">1. Tokens</a>
          <span>·</span>
          <a href="#hash-display" className="hover:underline">2. HashDisplay</a>
          <span>·</span>
          <a href="#severity-chip" className="hover:underline">3. SeverityChip</a>
          <span>·</span>
          <a href="#verification-badge" className="hover:underline">4. VerificationBadge</a>
          <span>·</span>
          <a href="#status-badge" className="hover:underline">5. StatusBadge</a>
          <span>·</span>
          <a href="#bit-grid" className="hover:underline">6. BitGrid</a>
          <span>·</span>
          <a href="#quorum-meter" className="hover:underline">7. QuorumMeter</a>
          <span>·</span>
          <a href="#stepper-progress" className="hover:underline">8. StepperProgress</a>
          <span>·</span>
          <a href="#skeletons" className="hover:underline">9. Skeletons</a>
          <span>·</span>
          <a href="#empty-state" className="hover:underline">10. EmptyState</a>
          <span>·</span>
          <a href="#offline-banner" className="hover:underline">11. OfflineBanner</a>
          <span>·</span>
          <a href="#auth-surfaces" className="hover:underline text-signal font-semibold">12. Auth Surfaces</a>
        </nav>

        <div className="space-y-12">
          {/* SECTION 1: DESIGN TOKENS SWATCHES */}
          <section id="tokens" className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                1. Design Tokens &amp; Contrast Floor (docs/06 §2)
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
                <div className="text-[11px] text-field-muted">#0C1413</div>
                <div className="mt-1 text-[10px] text-field-inert">Page bg</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-field-text border-field-hairline">
                <div className="font-semibold">--field-canopy</div>
                <div className="text-[11px] text-field-muted">#14201E</div>
                <div className="mt-1 text-[10px] text-field-inert">Cards, panels</div>
              </div>
              <div className="rounded border p-3 bg-field-raised text-field-text border-field-hairline">
                <div className="font-semibold">--field-raised</div>
                <div className="text-[11px] text-field-muted">#1C2B28</div>
                <div className="mt-1 text-[10px] text-field-inert">Hover, inputs</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy border-field-hairline text-signal">
                <div className="font-semibold">--signal</div>
                <div className="text-[11px]">#D7F6B8</div>
                <div className="mt-1 text-[10px] text-field-muted">1 action/screen</div>
              </div>
              <div className="rounded border p-3 bg-verified text-[#0C1413] border-verified">
                <div className="font-semibold">--verified (fill)</div>
                <div className="text-[11px]">#3E9D80</div>
                <div className="mt-1 text-[10px]">Text: #0C1413</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-chain border-field-hairline">
                <div className="font-semibold">--chain</div>
                <div className="text-[11px]">#7C8CF8</div>
                <div className="mt-1 text-[10px] text-field-muted">Base Sepolia</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-review border-field-hairline">
                <div className="font-semibold">--review</div>
                <div className="text-[11px]">#E8A33D</div>
                <div className="mt-1 text-[10px] text-field-muted">Human eye needed</div>
              </div>
              <div className="rounded border p-3 bg-field-canopy text-fraud border-field-hairline">
                <div className="font-semibold">--fraud</div>
                <div className="text-[11px]">#E2644F</div>
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
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                2. HashDisplay (docs/06 §3.2, §7)
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
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                3. SeverityChip (docs/06 §2.4)
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
                <span className="text-xs font-mono text-field-muted">From fixtures with counts:</span>
                <SeverityChip {...severityChipFixtures.mediumWithCount} theme={activeTheme} />
                <SeverityChip {...severityChipFixtures.highWithCount} theme={activeTheme} />
                <SeverityChip severity="info" count={5} label="Metadata note" theme={activeTheme} />
              </div>
            </div>
          </section>

          {/* SECTION 4: VERIFICATIONBADGE */}
          <section id="verification-badge" className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                4. VerificationBadge (docs/06 §7, docs/14 §4)
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Four states: MATCH, MISMATCH, PENDING, UNAVAILABLE. Unreachable RPC is neutral grey (never a false red mismatch).
              </p>
            </div>

            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border p-4",
                isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
              )}
            >
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-field-muted block">1. Confirmed Match:</span>
                <VerificationBadge {...verificationBadgeFixtures.matchFieldWithDetail} theme={activeTheme} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-field-muted block">2. Tamper Mismatch:</span>
                <VerificationBadge {...verificationBadgeFixtures.mismatchField} theme={activeTheme} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-field-muted block">3. Pending On-Chain:</span>
                <VerificationBadge {...verificationBadgeFixtures.pendingField} theme={activeTheme} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-field-muted block">4. RPC Unavailable:</span>
                <VerificationBadge {...verificationBadgeFixtures.unavailableField} theme={activeTheme} />
              </div>
            </div>
          </section>

          {/* SECTION 5: STATUSBADGE */}
          <section id="status-badge" className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                5. StatusBadge (docs/01 §State machine, docs/16 §A1)
              </h2>
              <p
                className={cn(
                  "text-xs",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Full workflow lifecycle including ESCALATED (split decision awaiting verifier admin deciding vote).
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
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                6. BitGrid (docs/17 §4)
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
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                7. QuorumMeter (docs/17 §4, docs/16 §A1)
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
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                8. StepperProgress (docs/15 §4)
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
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                9. Skeletons (docs/15 §3)
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
                <span className="text-xs font-mono text-field-muted">/lab Review Queue Skeleton:</span>
                <SkeletonSet.LabQueue theme={activeTheme} />
              </div>
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-mono text-field-muted">Findings Pane Skeleton:</span>
                  <SkeletonSet.FindingsPane theme={activeTheme} className="mt-1" />
                </div>
                <div>
                  <span className="text-xs font-mono text-field-muted">64-char Hash Skeleton (Zero Shift):</span>
                  <div className="mt-1">
                    <SkeletonSet.Hash theme={activeTheme} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-xs font-mono text-field-muted">Evidence Side-by-Side 4:3 Skeleton:</span>
              <SkeletonSet.EvidencePane theme={activeTheme} />
            </div>
          </section>

          {/* SECTION 10: EMPTYSTATE */}
          <section id="empty-state" className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                10. EmptyState (docs/15 §2)
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
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                11. OfflineBanner (docs/15 §5)
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
                <span className="text-[11px] font-mono text-field-muted block mb-1">State: Offline with 2 queued submissions:</span>
                <OfflineBanner {...offlineBannerFixtures.offlineWithQueue} theme={activeTheme} />
              </div>

              <div>
                <span className="text-[11px] font-mono text-field-muted block mb-1">State: Offline, queue empty (IndexedDB standby):</span>
                <OfflineBanner {...offlineBannerFixtures.offlineZeroQueue} theme={activeTheme} />
              </div>

              <div>
                <span className="text-[11px] font-mono text-field-muted block mb-1">State: Reconnected, actively syncing queue:</span>
                <OfflineBanner {...offlineBannerFixtures.syncingQueue} theme={activeTheme} />
              </div>
            </div>
          </section>

          {/* SECTION 12: AUTH SURFACES */}
          <section id="auth-surfaces" className="space-y-6 pt-6 border-t border-inherit">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">
                  12. Authentication &amp; Onboarding Surfaces (docs/15 §6)
                </h2>
                <span className="rounded border px-2 py-0.5 font-mono text-[10px] text-signal bg-field-raised border-field-hairline">
                  45/55 Asymmetric Split
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
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs font-mono text-field-text hover:border-signal transition-colors"
              >
                <span>Route: /sign-in</span>
                <span className="text-signal">→</span>
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs font-mono text-field-text hover:border-signal transition-colors"
              >
                <span>Route: /sign-up (2 Steps)</span>
                <span className="text-signal">→</span>
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-raised px-3 py-1.5 text-xs font-mono text-field-text hover:border-signal transition-colors"
              >
                <span>Route: /demo (4 Roles)</span>
                <span className="text-signal">→</span>
              </Link>
            </div>

            {/* ProofPreview Component (Desktop & Collapsed) */}
            <div className="space-y-3">
              <span className="text-xs font-mono text-field-muted block">
                ProofPreview Artifact (Left 45% Panel &amp; Collapsed Mobile Bar):
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
                <span className="text-xs font-mono text-signal block mb-3">
                  Embedded Sign-In View:
                </span>
                <SignInPage />
              </div>

              {/* Demo Persona Switcher Embed */}
              <div className="rounded-lg border border-field-hairline bg-field-abyss p-6">
                <span className="text-xs font-mono text-signal block mb-3">
                  Embedded Demo Switcher View:
                </span>
                <DemoPage onSelectPersona={(p) => alert(`Selected persona: ${p.roleTitle} (${p.organization})`)} />
              </div>
            </div>

            {/* Sign Up Two-Step Form Embed */}
            <div className="rounded-lg border border-field-hairline bg-field-abyss p-6 max-w-xl">
              <span className="text-xs font-mono text-signal block mb-3">
                Embedded Sign-Up View (Step 1 + Step 2 Type Cards):
              </span>
              <SignUpPage />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
