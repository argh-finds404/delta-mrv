import * as React from "react";
import Link from "next/link";
import {
  Building,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Compass,
} from "lucide-react";
import {
  VerificationBadge,
  StatusBadge,
  EmptyState,
} from "@/src/components";
import {
  sampleAtlasProjects,
  emptyProofProject,
  type AtlasProject,
} from "@/src/components/atlas/fixtures";
import { cn } from "@/src/lib/utils";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;

  // Resolve project from fixtures (or fallback to empty proof project if requested)
  let project: AtlasProject | undefined;
  if (slug === "empty" || slug === emptyProofProject.slug) {
    project = emptyProofProject;
  } else {
    project = sampleAtlasProjects.find((p) => p.slug === slug) ?? sampleAtlasProjects[0];
  }

  const totalSubmissions = Object.values(project.submissionCounts).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div
      data-theme="paper"
      className="min-h-screen bg-paper text-paper-ink font-sans transition-colors"
    >
      {/* Top Paper Header Bar */}
      <nav className="border-b border-paper-rule bg-paper-card px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/atlas" className="flex items-center gap-2 group">
            <div className="flex size-6 items-center justify-center rounded-xs bg-paper border border-paper-rule">
              <span className="font-serif font-bold text-paper-seal text-xs">Δ</span>
            </div>
            <span className="font-medium text-xs text-paper-ink group-hover:underline">
              Delta MRV
            </span>
            <span className="text-paper-muted text-xs">/</span>
            <span className="font-mono text-xs text-paper-muted">Projects</span>
          </Link>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/atlas"
              className="font-mono text-xs text-paper-muted hover:text-paper-ink transition-colors"
            >
              ← Back to Impact Atlas
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Single-Column Paper Measure */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
        {/* 1. Header (docs/14-PAGE-SPEC.md §3) */}
        <header className="space-y-4 border-b border-paper-rule pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-paper-muted">
              {project.activityType}
            </span>
            <VerificationBadge
              state={project.verificationStatus}
              detail="Base Sepolia Anchor"
              theme="paper"
            />
          </div>

          <h1 className="font-serif text-3xl font-medium tracking-tight text-paper-ink sm:text-4xl">
            {project.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-paper-muted pt-1">
            <div className="flex items-center gap-1.5">
              <Building className="size-4 shrink-0 text-paper-ink" />
              <span className="font-medium text-paper-ink">{project.ownerOrg}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5 font-mono">
              <MapPin className="size-4 shrink-0 text-paper-seal" />
              <span>{project.location.region}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1 font-mono tabular-nums">
              <span>{totalSubmissions} evidence events recorded</span>
            </div>
          </div>
        </header>

        {/* 2. The Claim and the Record, Side by Side (The Honest Gap) */}
        <section aria-labelledby="track-record-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="track-record-heading"
              className="font-serif text-xl font-medium text-paper-ink"
            >
              Ecological Claim vs. Independently Verified Record
            </h2>
            <span className="font-mono text-[11px] text-paper-muted">
              docs/14 §3
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Claim */}
            <div className="rounded-lg border border-paper-rule bg-paper-card p-5 space-y-2">
              <span className="font-mono text-xs uppercase tracking-wider text-paper-muted block">
                1. Project Developer Claim
              </span>
              <div className="text-xl font-semibold font-mono tabular-nums text-paper-ink">
                {project.reportedImpact}
              </div>
              <p className="text-xs text-paper-muted leading-relaxed">
                Self-reported metrics submitted by {project.ownerOrg} upon site registration.
              </p>
            </div>

            {/* Right: Record */}
            <div className="rounded-lg border border-paper-seal/40 bg-paper-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-paper-seal flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  <span>2. Anchored Cryptographic Proof</span>
                </span>
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums text-paper-ink">
                {project.verifiedImpact}
              </div>
              <p className="text-xs text-paper-muted leading-relaxed">
                Recomputed perceptual hashes validated by two independent verifiers and confirmed in on-chain Merkle batches.
              </p>
            </div>
          </div>

          {/* The Unflattering Gap Banner */}
          <div className="rounded-lg border border-[#E8A33D]/40 bg-[#E8A33D]/10 p-4 text-xs font-mono text-[#8F5B10] flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">The Claimed-vs-Verified Gap: </span>
              <span>{project.claimedVsVerifiedGap}. </span>
              <span className="block pt-1 opacity-90 font-sans">
                Delta displays unverified claims transparently. Unreviewed restoration is not treated as accomplished until independently verified.
              </span>
            </div>
          </div>
        </section>

        {/* 3. Boundary Map Placeholder */}
        <section aria-labelledby="boundary-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="boundary-heading"
              className="font-serif text-xl font-medium text-paper-ink"
            >
              Restoration Demarcation &amp; Geofence
            </h2>
            <span className="font-mono text-xs text-paper-muted">
              SRID 4326 PostGIS
            </span>
          </div>

          <div className="relative rounded-lg border border-paper-rule bg-[#EDE6D6] h-64 overflow-hidden flex flex-col justify-between p-4">
            <div className="flex items-center justify-between z-10">
              <span className="inline-flex items-center gap-1 rounded bg-paper-card border border-paper-rule px-2.5 py-1 font-mono text-[11px] text-paper-muted">
                <Compass className="size-3 text-paper-seal" />
                <span>Boundary Canvas (Fuzzed Centroid View)</span>
              </span>
              <span className="font-mono text-[11px] text-paper-muted tabular-nums">
                [{project.location.coordinatesFuzzed[0].toFixed(4)},{" "}
                {project.location.coordinatesFuzzed[1].toFixed(4)}]
              </span>
            </div>

            <div className="self-center font-mono text-xs text-paper-muted max-w-sm text-center z-10 space-y-1">
              <p className="font-medium text-paper-ink">
                Exact polygon boundary protected.
              </p>
              <p className="text-[11px]">
                Unauthenticated public viewers receive area-level coordinates. Signed-in authorized auditors unlock the verified polygon.
              </p>
            </div>

            <div className="z-10 flex justify-between items-center text-[10px] font-mono text-paper-muted">
              <span>Projection: EPSG:4326</span>
              <span>Carto Keyless Open Vector Basemap</span>
            </div>
          </div>
        </section>

        {/* 4. Evidence Timeline */}
        <section aria-labelledby="timeline-heading" className="space-y-4">
          <div className="flex items-center justify-between border-b border-paper-rule pb-2">
            <h2
              id="timeline-heading"
              className="font-serif text-xl font-medium text-paper-ink"
            >
              Evidence Submission Timeline
            </h2>
            <span className="font-mono text-xs text-paper-muted">
              Chronological Ledger
            </span>
          </div>

          {project.timeline.length === 0 ? (
            /* Empty State E2 (docs/15-UI-STATES.md §2) */
            <EmptyState
              title="No evidence submitted yet"
              reason="Evidence is a before and after photograph pair. Once submitted, it runs through forensic checks and then independent review."
              action={{
                label: "Submit initial evidence",
                href: `/projects/${project.id}/submit`,
              }}
              honestNote="Project developers can submit initial before/after photographic pairs once field work commences."
              theme="paper"
            />
          ) : (
            <div className="space-y-3">
              {project.timeline.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-paper-rule bg-paper-card p-4 transition-colors hover:border-paper-seal/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-paper-muted">
                        Round {item.round} ·
                      </span>
                      <h3 className="text-xs font-semibold text-paper-ink">
                        {item.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-paper-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        <span>{new Date(item.capturedAt).toLocaleDateString()}</span>
                      </span>
                      <span>·</span>
                      <span>
                        {item.findingsCount === 0
                          ? "Zero forensic anomalies"
                          : `${item.findingsCount} finding${item.findingsCount === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <StatusBadge status={item.status} theme="paper" />
                    {item.proofUrl ? (
                      <Link
                        href={item.proofUrl}
                        className="inline-flex items-center gap-1 rounded bg-paper-seal px-2.5 py-1 text-xs font-medium text-white hover:bg-paper-seal/90 transition-colors"
                      >
                        <span>Proof dossier</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    ) : (
                      <span className="text-[11px] font-mono text-paper-muted italic">
                        Verification in progress
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. Assigned Verifier Organisations (docs/14-PAGE-SPEC.md §3) */}
        <section aria-labelledby="verifiers-heading" className="space-y-3 border-t border-paper-rule pt-6">
          <div className="flex items-center justify-between">
            <h2
              id="verifiers-heading"
              className="font-serif text-lg font-medium text-paper-ink flex items-center gap-2"
            >
              <ShieldCheck className="size-4 text-paper-seal" />
              <span>Assigned Independent Verifier Organisations</span>
            </h2>
            <span className="font-mono text-[11px] text-paper-muted">
              Accountability Governance
            </span>
          </div>

          <p className="text-xs text-paper-muted leading-relaxed">
            Delta enforces strict multi-tenant conflict-of-interest gates. Reviewers must belong to an assigned independent verifier organisation distinct from the project owner.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {project.assignedVerifiers.map((v) => (
              <div
                key={v.slug}
                className="rounded-lg border border-paper-rule bg-paper-card p-3.5 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-xs text-paper-ink block">
                    {v.name}
                  </span>
                  <span className="font-mono text-[11px] text-paper-muted">
                    Assigned Auditor · Verified Tenant
                  </span>
                </div>
                <span className="font-mono text-[11px] text-paper-seal border border-paper-seal/30 bg-paper-seal/10 px-2 py-0.5 rounded">
                  Active
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Limits Footer (docs/14-PAGE-SPEC.md §3) */}
        <footer className="border-t border-paper-rule pt-8 text-xs text-paper-muted space-y-2">
          <div className="font-serif font-medium text-paper-ink text-sm">
            What this public record proves and does not prove
          </div>
          <p className="leading-relaxed">
            Delta proves that photographic evidence existed at a recorded point in time within the stated geofence, that perceptual difference hashes matched expected growth deltas, and that two independent verifiers approved the claim under hash-chained audit trails.
          </p>
          <p className="leading-relaxed italic">
            Delta does not prove that trees survive indefinitely, nor does it replace ground botanical surveys. A matching hash confirms record integrity; human verifier consensus confirms evidentiary standards.
          </p>
        </footer>
      </main>
    </div>
  );
}
