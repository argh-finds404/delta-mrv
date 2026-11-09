import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Clock,
  Compass,
  ExternalLink,
  FileCheck2,
  Plus,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { Wordmark } from "@/src/components/site/Wordmark";
import { ACTIVITY_LABEL, formatClaim, formatLatLon } from "@/src/lib/format";
import { cn } from "@/src/lib/utils";
import { requireSession } from "@/src/server/auth/session";
import { NotFoundError } from "@/src/server/services/errors";
import { getProject } from "@/src/server/services/projects.service";
import { listSubmissionsForProject } from "@/src/server/services/submissions.service";

interface WorkspaceProjectPageProps {
  params: Promise<{ id: string }>;
}

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function generateMetadata({
  params,
}: WorkspaceProjectPageProps): Promise<Metadata> {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) return { title: "Project Workspace · Delta" };
  return {
    title: `Project Workspace · ${id.slice(0, 8)} · Delta`,
    description: "Authenticated workspace for restoration monitoring and evidence submission.",
  };
}

export default function WorkspaceProjectPage({ params }: WorkspaceProjectPageProps) {
  return (
    <React.Suspense
      fallback={
        <div data-theme="field" className="min-h-screen bg-field-abyss p-8" aria-busy>
          <div className="mx-auto max-w-5xl animate-pulse space-y-4">
            <div className="h-6 w-32 rounded bg-field-raised" />
            <div className="h-10 w-96 rounded bg-field-raised" />
          </div>
        </div>
      }
    >
      <WorkspaceProjectBody params={params} />
    </React.Suspense>
  );
}

async function WorkspaceProjectBody({ params }: WorkspaceProjectPageProps) {
  await connection();
  const session = await requireSession();
  const { id } = await params;

  if (!isUuid(id)) notFound();

  const actor = { userId: session.user.id };

  let project;
  try {
    project = await getProject(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const submissions = await listSubmissionsForProject(actor, id);
  const claimText = formatClaim(project.claimedQuantity, project.claimedUnit);
  const isOwner = project.access === "owner";
  const isVerifier = project.access === "verifier";

  return (
    <div data-theme="field" className="min-h-screen bg-field-abyss text-field-text font-sans pb-16">
      {/* Workspace Header Bar */}
      <header className="flex h-12 select-none items-center justify-between border-b border-field-hairline bg-field-canopy px-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" aria-label="Delta Dashboard" className="transition-opacity hover:opacity-85">
            <Wordmark className="text-field-text" />
          </Link>
          <span className="text-field-hairline" aria-hidden="true">/</span>
          <span className="text-xs font-mono uppercase tracking-wider text-field-muted">Project Management</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/dashboard"
            className="text-field-muted hover:text-field-text transition-colors flex items-center gap-1 font-mono"
          >
            <ArrowLeft className="size-3.5" />
            <span>Dashboard</span>
          </Link>
          <span className="text-field-hairline">|</span>
          <Link
            href={`/p/${project.id}`}
            className="text-signal hover:underline transition-colors flex items-center gap-1 font-mono"
          >
            <span>Public View</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Project Header */}
        <section className="space-y-4 border-b border-field-hairline pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-field-hairline bg-field-canopy px-2.5 py-1 text-xs font-mono text-field-muted uppercase">
                {ACTIVITY_LABEL[project.activityType as keyof typeof ACTIVITY_LABEL] ?? project.activityType}
              </span>
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-mono uppercase",
                  project.status === "ACTIVE"
                    ? "border-verified/40 bg-verified/10 text-verified"
                    : "border-field-hairline bg-field-raised text-field-muted",
                )}
              >
                {project.status}
              </span>
              <span className="rounded-md border border-chain/40 bg-chain/10 px-2.5 py-1 text-xs font-mono text-chain uppercase">
                Role: {project.access}
              </span>
            </div>

            {isOwner && (
              <Link
                href={`/projects/${project.id}/submit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-signal px-4 text-xs font-medium text-field-abyss hover:bg-[#B9EA5F] transition-colors"
              >
                <Plus className="size-4" />
                <span>Submit Evidence Pair</span>
              </Link>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-field-text sm:text-3xl">
              {project.title}
            </h1>
            <p className="text-xs text-field-muted leading-relaxed max-w-2xl">
              {project.description ?? "Active environmental restoration initiative monitored through Delta MRV."}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
            <div className="rounded-lg border border-field-hairline bg-field-canopy p-3 space-y-1">
              <span className="text-field-muted block text-[10px] uppercase font-sans">Claimed Impact</span>
              <span className="font-semibold text-field-text text-sm font-sans">{claimText ?? "Unquantified"}</span>
            </div>
            <div className="rounded-lg border border-field-hairline bg-field-canopy p-3 space-y-1">
              <span className="text-field-muted block text-[10px] uppercase font-sans">Tolerance Buffer</span>
              <span className="font-semibold text-field-text text-sm font-sans">{project.toleranceMeters} meters</span>
            </div>
            <div className="rounded-lg border border-field-hairline bg-field-canopy p-3 space-y-1">
              <span className="text-field-muted block text-[10px] uppercase font-sans">Total Submissions</span>
              <span className="font-semibold text-field-text text-sm font-sans">{submissions.length}</span>
            </div>
            <div className="rounded-lg border border-field-hairline bg-field-canopy p-3 space-y-1">
              <span className="text-field-muted block text-[10px] uppercase font-sans">Boundary Mode</span>
              <span className="font-semibold text-verified text-sm font-sans">
                {project.exact ? "Exact Polygon Unlocked" : "Protected Centroid"}
              </span>
            </div>
          </div>
        </section>

        {/* Exact Demarcation & Salt (Amendment A6: Workspace gets exact geometry) */}
        <section aria-labelledby="geometry-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="geometry-heading" className="text-sm font-semibold text-field-text flex items-center gap-2">
              <Compass className="size-4 text-signal" />
              <span>Restoration Geofence &amp; Private Location Salt</span>
            </h2>
            <span className="text-xs font-mono text-field-muted">SRID 4326 PostGIS</span>
          </div>

          <div className="rounded-xl border border-field-hairline bg-field-canopy p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <span className="text-field-muted">
                Public Fuzzed Centroid:{" "}
                <strong className="text-field-text">
                  {project.fuzzedLocation ? formatLatLon(project.fuzzedLocation.coordinates) : "Registered"}
                </strong>
              </span>

              {project.exact && (
                <span className="rounded bg-verified/10 border border-verified/30 px-2 py-0.5 text-verified text-[11px]">
                  ✓ Authorized Session: Exact Coordinates Active
                </span>
              )}
            </div>

            {project.locationCommitment && (
              <div className="space-y-1">
                <span className="text-[11px] text-field-muted font-mono block">
                  Location Commitment (RFC 8785 SHA-256):
                </span>
                <HashDisplay hash={project.locationCommitment} variant="full" theme="field" label="Commitment" />
              </div>
            )}

            {project.exact?.locationSalt && (
              <div className="space-y-1">
                <span className="text-[11px] text-field-muted font-mono block">
                  Private Salt (disclosed only to authorized tenant members):
                </span>
                <HashDisplay hash={project.exact.locationSalt} variant="truncated" theme="field" label="Private Salt" />
              </div>
            )}
          </div>
        </section>

        {/* Submissions Timeline */}
        <section aria-labelledby="submissions-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="submissions-heading" className="text-sm font-semibold text-field-text flex items-center gap-2">
              <Clock className="size-4 text-signal" />
              <span>Submissions Timeline &amp; Review Status</span>
            </h2>
            <span className="text-xs font-mono text-field-muted">
              {submissions.length} Record{submissions.length === 1 ? "" : "s"}
            </span>
          </div>

          {submissions.length === 0 ? (
            <div className="rounded-xl border border-field-hairline bg-field-canopy p-8 text-center space-y-3">
              <Camera className="size-8 mx-auto text-field-muted opacity-50" />
              <div>
                <span className="text-xs font-medium text-field-text block">No evidence submitted yet</span>
                <span className="text-[11px] text-field-muted block">
                  Field officers can submit BEFORE and AFTER photographic pairs to initiate forensic intake.
                </span>
              </div>
              {isOwner && (
                <Link
                  href={`/projects/${project.id}/submit`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-signal px-4 text-xs font-medium text-field-abyss hover:bg-[#B9EA5F] transition-colors"
                >
                  <Plus className="size-4" />
                  <span>Submit First Evidence Pair</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => {
                const isNeedsMoreProof = sub.status === "NEEDS_MORE_PROOF";
                const isApprovedOrAnchored = sub.status === "APPROVED" || sub.status === "ANCHORED";

                return (
                  <div
                    key={sub.id}
                    className={cn(
                      "rounded-xl border p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                      isNeedsMoreProof
                        ? "border-review/40 bg-review/5"
                        : "border-field-hairline bg-field-canopy hover:border-field-muted",
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-field-text">
                          Round {sub.round}
                        </span>
                        <span className="text-field-hairline">·</span>
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-mono uppercase border",
                            sub.status === "APPROVED" || sub.status === "ANCHORED"
                              ? "border-verified/40 bg-verified/10 text-verified"
                              : sub.status === "NEEDS_MORE_PROOF"
                                ? "border-review/40 bg-review/10 text-review"
                                : sub.status === "REJECTED"
                                  ? "border-fraud/40 bg-fraud/10 text-fraud"
                                  : "border-field-hairline bg-field-raised text-field-muted",
                          )}
                        >
                          {sub.status.replaceAll("_", " ")}
                        </span>
                        {sub.riskBand && (
                          <span
                            className={cn(
                              "text-[10px] font-mono px-1.5 py-0.5 rounded",
                              sub.riskBand === "concern" ? "text-fraud bg-fraud/10" : "text-field-muted bg-field-raised",
                            )}
                          >
                            Risk: {sub.riskBand}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-field-muted">
                        Submission ID: <span className="text-field-text">{sub.id.slice(0, 8)}</span> · Submitted{" "}
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isNeedsMoreProof && isOwner && (
                        <Link
                          href={`/projects/${project.id}/submit?supplement=${sub.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-review px-3 text-xs font-medium text-field-abyss hover:bg-review/90 transition-colors"
                        >
                          <AlertTriangle className="size-3.5" />
                          <span>Provide Proof (Round {sub.round + 1})</span>
                        </Link>
                      )}

                      {isApprovedOrAnchored && (
                        <Link
                          href={`/proof/${sub.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-field-hairline bg-field-raised px-3 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors font-mono"
                        >
                          <FileCheck2 className="size-3.5 text-signal" />
                          <span>Proof Dossier</span>
                        </Link>
                      )}

                      {isVerifier && sub.status === "IN_REVIEW" && (
                        <Link
                          href="/lab"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-signal px-3 text-xs font-medium text-field-abyss hover:bg-[#B9EA5F] transition-colors"
                        >
                          <span>Review in Lab</span>
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

