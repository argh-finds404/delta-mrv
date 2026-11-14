import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  Building,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Compass,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { VerificationBadge } from "@/src/components/verification-badge/verification-badge";
import { SiteFooter } from "@/src/components/site/SiteFooter";
import { SiteHeader } from "@/src/components/site/SiteHeader";
import { ACTIVITY_LABEL, formatClaim, formatCount, formatLatLon } from "@/src/lib/format";
import { DOES_NOT_PROVE, PROVES } from "@/src/lib/limits";
import { NotFoundError } from "@/src/server/services/errors";
import { getPublicProject, type PublicProjectDetail } from "@/src/server/services/projects.service";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) return { title: "Project · Delta" };
  try {
    const project = await getPublicProject(id);
    return {
      title: `${project.title} · Delta`,
      description: project.description ?? "Restoration site under independent review.",
    };
  } catch (e) {
    if (e instanceof NotFoundError) return { title: "Project · Delta" };
    throw e;
  }
}

// Read at request time (cacheComponents): the body streams inside Suspense, so the build never prerenders data.
export default function PublicProjectPage({ params }: ProjectPageProps) {
  return (
    <div data-theme="paper" className="min-h-dvh bg-paper font-sans text-paper-ink">
      <SiteHeader />
      <React.Suspense fallback={<main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-8" aria-busy />}>
        <ProjectBody params={params} />
      </React.Suspense>
      <SiteFooter />
    </div>
  );
}

async function ProjectBody({ params }: ProjectPageProps) {
  await connection();
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  let project: PublicProjectDetail;
  try {
    project = await getPublicProject(id);
  } catch (e) {
    // only a missing or non-public project is a 404; a database failure must surface, not hide as one
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const claimText = formatClaim(project.claimedQuantity, project.claimedUnit);
  const totalEvidence = project.record.approved + project.record.anchored;

  return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
        <Link href="/atlas" className="inline-flex text-[14px] text-paper-muted transition-colors hover:text-paper-ink">
          ← The atlas of sites
        </Link>

        {/* 1. Header (docs/14-PAGE-SPEC.md §3) */}
        <header className="space-y-4 border-b border-paper-rule pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-paper-muted">
              {ACTIVITY_LABEL[project.activityType] ?? project.activityType}
            </span>
            <VerificationBadge
              state={project.record.anchored > 0 ? "MATCH" : project.record.approved > 0 ? "PENDING" : "UNAVAILABLE"}
              detail={project.record.anchored > 0 ? "Base Sepolia anchored" : "Two independent reviews"}
              theme="paper"
            />
          </div>

          <h1 className="font-serif text-3xl font-medium tracking-tight text-paper-ink sm:text-4xl">
            {project.title}
          </h1>

          {project.description && (
            <p className="text-sm text-paper-muted max-w-2xl leading-relaxed">
              {project.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-paper-muted pt-1">
            <div className="flex items-center gap-1.5">
              <Building className="size-4 shrink-0 text-paper-ink" />
              <span className="font-medium text-paper-ink">{project.ownerOrgName}</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-paper-seal" />
              <span>
                {project.fuzzedLocation
                  ? formatLatLon(project.fuzzedLocation.coordinates)
                  : "Approximate location"}
              </span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1 tabular-nums">
              <span>{formatCount(totalEvidence)} verified submissions</span>
            </div>
          </div>
        </header>

        {/* 2. The Claim and the Record, Side by Side (docs/14-PAGE-SPEC.md §3) */}
        <section aria-labelledby="track-record-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="track-record-heading"
              className="font-serif text-xl font-medium text-paper-ink"
            >
              Ecological Claim vs. Independently Verified Record
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Claim */}
            <div className="rounded-lg border border-paper-rule bg-paper-card p-5 space-y-2">
              <span className="text-xs font-medium text-paper-muted block">
                1. Project developer claim
              </span>
              <div className="text-xl font-semibold font-mono tabular-nums text-paper-ink">
                {claimText ?? "Unquantified claim"}
              </div>
              <p className="text-xs text-paper-muted leading-relaxed">
                Self-reported metrics registered by {project.ownerOrgName}.
              </p>
            </div>

            {/* Right: Record */}
            <div className="rounded-lg border border-paper-seal/40 bg-paper-card p-5 space-y-2 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-paper-seal flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    <span>2. Anchored cryptographic proof</span>
                  </span>
                </div>
                <div className="text-xl font-semibold font-mono tabular-nums text-paper-ink">
                  {formatCount(totalEvidence)} approved
                  {project.record.anchored > 0 && ` (${formatCount(project.record.anchored)} anchored)`}
                </div>
                <p className="text-xs text-paper-muted leading-relaxed">
                  Submissions approved by two independent reviewer organisations.
                </p>
              </div>

              {project.proofs.length > 0 && (
                <ul className="space-y-1 border-t border-paper-rule/60 pt-3">
                  {project.proofs.map((p) => (
                    <li key={p.id}>
                      <Link href={`/proof/${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-paper-seal hover:underline">
                        <span>
                          Proof of the {p.status === "ANCHORED" ? "anchored" : "approved"} record of {p.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                        </span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Unflattering gap banner */}
          <div className="rounded-lg border border-[#E8A33D]/40 bg-[#E8A33D]/10 p-4 text-xs font-sans text-[#8F5B10] flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">The honest gap: </span>
              <span className="opacity-90">
                Delta displays claims beside verified records without smoothing over discrepancies. A claim is what someone says; the record is what two reviewers from an independent organisation approved.
              </span>
            </div>
          </div>
        </section>

        {/* 3. Boundary Map / Protected Location (Amendment A6) */}
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

          <div className="relative rounded-lg border border-paper-rule bg-[#EDE6D6] min-h-56 overflow-hidden flex flex-col justify-between p-6">
            <div className="flex items-center justify-between z-10">
              <span className="inline-flex items-center gap-1 rounded bg-paper-card border border-paper-rule px-2.5 py-1 text-[11px] text-paper-muted">
                <Compass className="size-3 text-paper-seal" />
                <span>Boundary canvas (fuzzed cell-centre view)</span>
              </span>
              {project.fuzzedLocation && (
                <span className="font-mono text-[11px] text-paper-muted tabular-nums">
                  {formatLatLon(project.fuzzedLocation.coordinates)}
                </span>
              )}
            </div>

            <div className="self-center text-xs text-paper-muted max-w-md text-center z-10 space-y-2 py-6">
              <p className="font-medium text-paper-ink">
                Exact polygon boundary protected.
              </p>
              <p className="text-[12px] leading-relaxed">
                Public viewers receive area-level coordinates (approx. 5.5 km grid cell). The exact boundary is withheld on public routes to protect the restoration plot.
              </p>
              {project.locationCommitment && (
                <div className="pt-2 flex flex-col items-center gap-1">
                  <span className="text-[11px] text-paper-muted">Salted location commitment:</span>
                  <HashDisplay hash={project.locationCommitment} variant="truncated" theme="paper" label="Commitment" />
                </div>
              )}
            </div>

            <div className="z-10 flex justify-between items-center text-[10px] font-mono text-paper-muted">
              <span>Projection: EPSG:4326</span>
              <Link href={`/atlas?site=${project.id}`} className="inline-flex items-center gap-1 text-paper-ink hover:underline">
                <span>View on Atlas</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* 4. Assigned Verifier Organisations */}
        <section aria-labelledby="verifiers-heading" className="space-y-3 border-t border-paper-rule pt-6">
          <div className="flex items-center justify-between">
            <h2
              id="verifiers-heading"
              className="font-serif text-lg font-medium text-paper-ink flex items-center gap-2"
            >
              <ShieldCheck className="size-4 text-paper-seal" />
              <span>Assigned Independent Verifier Organisations</span>
            </h2>
            <span className="text-[11px] text-paper-muted">
              Accountability governance
            </span>
          </div>

          <p className="text-xs text-paper-muted leading-relaxed">
            Delta enforces strict multi-tenant conflict-of-interest gates. Nobody reviews their own organisation&apos;s work. Reviewers must belong to an assigned independent verifier organisation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {project.verifierOrgNames.length > 0 ? (
              project.verifierOrgNames.map((name) => (
                <div
                  key={name}
                  className="rounded-lg border border-paper-rule bg-paper-card p-3.5 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-xs text-paper-ink block">
                      {name}
                    </span>
                    <span className="text-[11px] text-paper-muted">
                      Assigned auditor · Independent verifier
                    </span>
                  </div>
                  <span className="text-[11px] text-paper-seal border border-paper-seal/30 bg-paper-seal/10 px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-paper-muted italic">No independent verifier organisations assigned yet.</p>
            )}
          </div>
        </section>

        {/* 5. Limits, verbatim from docs/00-PRODUCT.md §3 (src/lib/limits.ts) */}
        <section aria-labelledby="limits-heading" className="space-y-4 border-t border-paper-rule pt-8">
          <h2 id="limits-heading" className="font-serif text-lg font-medium text-paper-ink">
            What this record proves, and what it does not
          </h2>
          <div className="grid gap-6 text-[14px] leading-[1.55] md:grid-cols-2">
            {[
              ["It proves", PROVES],
              ["It does not prove", DOES_NOT_PROVE],
            ].map(([title, items]) => (
              <div key={title as string} className="space-y-2">
                <h3 className="font-medium">{title as string}</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-paper-muted">
                  {(items as readonly string[]).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
  );
}
