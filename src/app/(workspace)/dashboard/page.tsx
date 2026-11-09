import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  FolderPlus,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { SeverityChip } from "@/src/components/severity-chip/severity-chip";
import { EmptyState } from "@/src/components/empty-state/empty-state";
import { ACTIVITY_LABEL, formatClaim, formatCount } from "@/src/lib/format";
import { requireSession } from "@/src/server/auth/session";
import { listProjects } from "@/src/server/services/projects.service";
import { reviewQueueOverview } from "@/src/server/services/reviews.service";
import { listSubmissionsForProject } from "@/src/server/services/submissions.service";

export const metadata: Metadata = {
  title: "Dashboard · Delta",
  description: "Role-aware home answering what needs your attention.",
};

// Read at request time (cacheComponents): the body streams inside Suspense, so the build never prerenders data.
export default function DashboardPage() {
  return (
    <React.Suspense fallback={<div className="min-h-dvh bg-field-abyss" aria-busy />}>
      <Dashboard />
    </React.Suspense>
  );
}

async function Dashboard() {
  await connection();
  const session = await requireSession();
  const actor = { userId: session.user.id };

  const [queueOverview, projects] = await Promise.all([
    // no .catch: a failed read must reach the error boundary, not render as an all-clear dashboard
    reviewQueueOverview(actor),
    listProjects(actor),
  ]);

  const ownedProjects = projects.filter((p) => p.access === "owner");
  const assignedProjects = projects.filter((p) => p.access === "verifier");

  // Load submissions for owned projects to surface actionable needs-more-proof submissions
  const ownedSubmissionsLists = await Promise.all(
    ownedProjects.map((p) => listSubmissionsForProject(actor, p.id)),
  );
  const ownedSubmissions = ownedSubmissionsLists.flat();
  const needsMoreProof = ownedSubmissions.filter((s) => s.status === "NEEDS_MORE_PROOF");
  const inReviewCount = ownedSubmissions.filter((s) => s.status === "IN_REVIEW" || s.status === "ESCALATED").length;
  const approvedCount = ownedSubmissions.filter((s) => s.status === "APPROVED" || s.status === "ANCHORED").length;
  const anchoredCount = ownedSubmissions.filter((s) => s.status === "ANCHORED").length;

  const isOwner = ownedProjects.length > 0;
  const isVerifier = queueOverview.isVerifier;
  const hasNoOrg = !isOwner && !isVerifier && projects.length === 0;

  return (
    <div data-theme="field" className="min-h-screen bg-field-abyss text-field-text font-sans">
      {/* Top Navigation */}
      <header className="border-b border-field-hairline bg-field-canopy px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Delta Home" className="focus-visible:outline-signal">
              <Wordmark className="text-field-text" />
            </Link>
            <span className="text-field-hairline">/</span>
            <span className="text-xs font-mono uppercase tracking-wider text-field-muted">Dashboard</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/atlas"
              className="inline-flex items-center gap-1.5 text-field-muted hover:text-field-text transition-colors"
            >
              <Compass className="size-3.5" />
              <span>Impact Atlas</span>
            </Link>

            {isVerifier && (
              <Link
                href="/lab"
                className="inline-flex items-center gap-1.5 rounded-md border border-signal/40 bg-signal/15 px-3 py-1.5 font-medium text-signal hover:bg-signal/25 transition-colors"
              >
                <ShieldCheck className="size-3.5" />
                <span>Review Lab ({queueOverview.total})</span>
              </Link>
            )}

            <div className="hidden sm:flex items-center gap-2 border-l border-field-hairline pl-4 text-field-muted">
              <span className="truncate max-w-[160px]">{session.user.name || session.user.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Role-Aware Dashboard Content */}
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {/* Welcome Eyebrow */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-field-hairline pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isVerifier
                ? "Verifier Workspace"
                : isOwner
                  ? "Project Developer Workspace"
                  : "Workspace Overview"}
            </h1>
            <p className="text-xs text-field-muted mt-1">
              Signed in as <span className="font-mono text-field-text">{session.user.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <Link
                href="/atlas"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-field-raised border border-field-hairline px-3.5 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors"
              >
                <FolderPlus className="size-3.5" />
                <span>View Sites</span>
              </Link>
            )}
          </div>
        </div>

        {/* 1. VERIFIER VIEW (docs/14-PAGE-SPEC.md §8) */}
        {isVerifier && (
          <div className="space-y-8">
            {/* Top-Left Actionable: Review Queue Depth */}
            <section aria-labelledby="verifier-queue-heading" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 id="verifier-queue-heading" className="text-sm font-semibold text-field-muted uppercase tracking-wider font-mono">
                  Review Queue Depth
                </h2>
                <span className="text-xs font-mono text-field-muted">docs/14 §8</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-field-hairline bg-field-canopy p-5 space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-field-muted">Awaiting Verification</span>
                    <span className="size-2 rounded-full bg-signal" aria-hidden />
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-4xl font-bold tabular-nums text-field-text">
                      {formatCount(queueOverview.total)}
                    </span>
                    <span className="text-xs text-field-muted">submissions pending review</span>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/lab"
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-4 text-xs font-medium text-field-abyss hover:bg-[#B9EA5F] transition-colors focus-visible:outline-2 focus-visible:outline-signal"
                    >
                      <span>Open Review Lab</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-field-hairline bg-field-canopy p-5 space-y-3 flex flex-col justify-between">
                  <span className="text-xs text-field-muted">High Severity Flags</span>
                  <div className="space-y-1">
                    <span className="font-mono text-3xl font-bold tabular-nums text-fraud">
                      {formatCount(queueOverview.items.filter((i) => i.findingCounts.high > 0).length)}
                    </span>
                    <p className="text-[11px] text-field-muted">Duplicate or perimeter breaches</p>
                  </div>
                  <SeverityChip severity="high" label="Priority" theme="field" />
                </div>

                <div className="rounded-xl border border-field-hairline bg-field-canopy p-5 space-y-3 flex flex-col justify-between">
                  <span className="text-xs text-field-muted">Assigned Projects</span>
                  <div className="space-y-1">
                    <span className="font-mono text-3xl font-bold tabular-nums text-field-text">
                      {formatCount(assignedProjects.length)}
                    </span>
                    <p className="text-[11px] text-field-muted">Audited by your organisation</p>
                  </div>
                  <span className="text-[11px] font-mono text-field-muted">2-of-N independent quorum</span>
                </div>
              </div>
            </section>

            {/* Next Items to Review */}
            {queueOverview.items.length > 0 && (
              <section aria-labelledby="pending-submissions-heading" className="space-y-4">
                <div className="flex items-center justify-between border-b border-field-hairline pb-2">
                  <h3 id="pending-submissions-heading" className="text-sm font-medium text-field-text">
                    Pending In Queue
                  </h3>
                  <Link href="/lab" className="text-xs text-signal hover:underline">
                    View all in Lab →
                  </Link>
                </div>

                <div className="divide-y divide-field-hairline rounded-xl border border-field-hairline bg-field-canopy overflow-hidden">
                  {queueOverview.items.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-field-raised/60 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-field-text">{item.projectTitle}</span>
                          <span className="text-xs text-field-muted">· {item.ownerOrgName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-field-muted">
                          <span>Round {item.round}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">{new Date(item.submittedAt).toLocaleDateString()}</span>
                          {item.findingCounts.high > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-fraud">{item.findingCounts.high} high finding{item.findingCounts.high === 1 ? "" : "s"}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge status={item.status} theme="field" />
                        <Link
                          href="/lab"
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-field-hairline bg-field-raised px-3 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 2. OWNER / DEVELOPER VIEW (docs/14-PAGE-SPEC.md §8) */}
        {isOwner && (
          <div className="space-y-8">
            {/* Top Actionable Item: Submissions needing more proof */}
            {needsMoreProof.length > 0 && (
              <div className="rounded-xl border border-review/40 bg-review/10 p-5 space-y-3">
                <div className="flex items-center gap-2 text-review">
                  <AlertTriangle className="size-5 shrink-0" />
                  <h2 className="text-sm font-semibold">Action Required: Additional Photographic Proof Requested</h2>
                </div>
                <p className="text-xs text-field-muted leading-relaxed">
                  Independent reviewers flagged {needsMoreProof.length} submission{needsMoreProof.length === 1 ? "" : "s"} requiring supplementary photos or clearer plot angles.
                </p>
                <div className="space-y-2 pt-1">
                  {needsMoreProof.slice(0, 3).map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between rounded-lg border border-review/30 bg-field-canopy p-3 text-xs">
                      <div>
                        <span className="font-medium text-field-text">Submission round {sub.round}</span>
                        <span className="text-field-muted block text-[11px]">Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>
                      </div>
                      <Link
                        href={`/projects/${sub.projectId}/submit`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-review px-3 py-1 font-medium text-field-abyss hover:bg-review/90 transition-colors"
                      >
                        <span>Provide Proof</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics Overview */}
            <section aria-labelledby="owner-metrics-heading" className="space-y-4">
              <h2 id="owner-metrics-heading" className="text-sm font-semibold text-field-muted uppercase tracking-wider font-mono">
                Project &amp; Evidence Overview
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-field-hairline bg-field-canopy p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-field-muted">
                    <span>Registered Sites</span>
                    <Layers className="size-4" />
                  </div>
                  <div className="font-mono text-3xl font-bold tabular-nums text-field-text">
                    {formatCount(ownedProjects.length)}
                  </div>
                  <p className="text-[11px] text-field-muted">Active restoration boundaries</p>
                </div>

                <div className="rounded-xl border border-field-hairline bg-field-canopy p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-field-muted">
                    <span>Under Review</span>
                    <Clock className="size-4 text-review" />
                  </div>
                  <div className="font-mono text-3xl font-bold tabular-nums text-field-text">
                    {formatCount(inReviewCount)}
                  </div>
                  <p className="text-[11px] text-field-muted">Currently evaluated by independent auditors</p>
                </div>

                <div className="rounded-xl border border-field-hairline bg-field-canopy p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-field-muted">
                    <span>Approved &amp; Anchored</span>
                    <CheckCircle2 className="size-4 text-verified" />
                  </div>
                  <div className="font-mono text-3xl font-bold tabular-nums text-field-text">
                    {formatCount(approvedCount)}
                  </div>
                  <p className="text-[11px] text-field-muted">{anchoredCount} confirmed on Base Sepolia</p>
                </div>
              </div>
            </section>

            {/* Owned Projects List */}
            <section aria-labelledby="owned-projects-heading" className="space-y-4">
              <div className="flex items-center justify-between border-b border-field-hairline pb-2">
                <h3 id="owned-projects-heading" className="text-sm font-medium text-field-text">
                  Your Restoration Projects
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-xl border border-field-hairline bg-field-canopy p-5 flex flex-col justify-between space-y-4 hover:border-field-inert transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-field-muted">
                          {ACTIVITY_LABEL[project.activityType] ?? project.activityType}
                        </span>
                        <span className="size-2 rounded-full bg-verified" aria-hidden />
                      </div>
                      <h4 className="text-base font-medium text-field-text">{project.title}</h4>
                      {project.description && (
                        <p className="text-xs text-field-muted line-clamp-2 leading-relaxed">{project.description}</p>
                      )}
                      <div className="text-xs font-mono tabular-nums text-field-muted pt-1">
                        Claimed: {formatClaim(project.claimedQuantity, project.claimedUnit) ?? "Unquantified"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-field-hairline pt-4">
                      <Link
                        href={`/p/${project.id}`}
                        className="text-xs text-field-muted hover:text-field-text transition-colors flex items-center gap-1"
                      >
                        <span>Public View</span>
                        <ArrowRight className="size-3" />
                      </Link>
                      <Link
                        href={`/projects/${project.id}/submit`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-field-hairline bg-field-raised px-3 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors"
                      >
                        <FileCheck2 className="size-3.5" />
                        <span>Submit Pair</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* 3. NO ORGANISATION EMPTY STATE (docs/14-PAGE-SPEC.md §8) */}
        {hasNoOrg && (
          <div className="py-12">
            <EmptyState
              title="No active organisation membership"
              reason="Your session is authenticated, but your account is not currently assigned to a project developer or independent verifier organisation."
              honestNote="Delta MRV isolates developer evidence and verifier quorums by organisation tenant. A member with no organisation has no voting or submission rights."
              action={{
                label: "Explore Impact Atlas",
                href: "/atlas",
              }}
              theme="field"
            />

            <div className="mt-8 mx-auto max-w-md rounded-xl border border-field-hairline bg-field-canopy p-4 text-xs text-field-muted space-y-2 text-center">
              <p className="font-medium text-field-text">Testing demo accounts?</p>
              <p>
                You can switch between Verifier One, Verifier Two, Project Developer, and Funder personas instantly via the demo role switcher.
              </p>
              <div className="pt-2">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-1 text-signal hover:underline font-mono"
                >
                  <span>Open Demo Switcher</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
