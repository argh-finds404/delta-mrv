import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, Camera, ExternalLink } from "lucide-react";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { SitesMap } from "@/src/components/app/SitesMap";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { activityColor } from "@/src/lib/activity";
import { ACTIVITY_LABEL, formatClaim, formatCount, formatLatLon } from "@/src/lib/format";
import { isOperator } from "@/src/server/services/operators";
import { STATUS_META, STATUS_ORDER } from "@/src/lib/status";
import { requireSession } from "@/src/server/auth/session";
import { NotFoundError } from "@/src/server/services/errors";
import { getProject, myOrganisations } from "@/src/server/services/projects.service";
import { listSubmissionsForProject } from "@/src/server/services/submissions.service";
import { workspaceSites } from "../../sites";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Project · Delta",
  description: "A restoration site on the map, its submissions and where each one stands.",
};

const RECENT = 30;
const primary =
  "inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const secondary =
  "inline-flex h-11 items-center gap-2 rounded-xl border border-field-hairline bg-field-canopy px-4 text-[15px] font-medium transition-colors hover:bg-field-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function WorkspaceProjectPage({ params }: Props) {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <ProjectBody params={params} />
    </React.Suspense>
  );
}

async function ProjectBody({ params }: Props) {
  await connection();
  const session = await requireSession();
  const { id } = await params;
  const actor = { userId: session.user.id };

  const project = await getProject(actor, id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [submissions, orgs, sites] = await Promise.all([listSubmissionsForProject(actor, id), myOrganisations(actor), workspaceSites(session.user.id, [project])]);

  const isOwner = project.access === "owner";
  const hue = activityColor(project.activityType);
  const counts = new Map(STATUS_ORDER.map((s) => [s, submissions.filter((x) => x.status === s).length]));
  const isVerifierOrg = orgs.some((o) => o.orgType === "VERIFIER");

  return (
    <AppShell userName={session.user.name || session.user.email} context={orgs[0]?.orgName} review={isVerifierOrg ? { count: 0 } : null} operator={await isOperator({ userId: session.user.id })}>
      <main className="mx-auto max-w-[1200px] space-y-10 px-4 py-8 sm:px-6 lg:py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[14px] text-field-muted transition-colors hover:text-field-text">
          <ArrowLeft className="size-4" aria-hidden />
          Overview
        </Link>

        <header className="rise-in flex flex-wrap items-end justify-between gap-6" style={rise(0)}>
          <div className="max-w-[760px] space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className="rounded-full px-2.5 py-0.5 font-medium" style={{ color: hue, background: `color-mix(in srgb, ${hue} 12%, white)` }}>
                {ACTIVITY_LABEL[project.activityType]}
              </span>
              <span className="text-field-muted">{isOwner ? "Your organisation's project" : "A project your organisation reviews"}</span>
              {project.status !== "ACTIVE" && <span className="rounded-full bg-field-raised px-2.5 py-0.5 text-field-muted">{project.status === "CLOSED" ? "Closed" : "Draft"}</span>}
            </p>
            <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">{project.title}</h1>
            <p className="text-[17px] text-field-muted">
              Claims {formatClaim(project.claimedQuantity, project.claimedUnit) ?? "no specific quantity"}. Photos are checked against a boundary with {formatCount(project.toleranceMeters)} m of tolerance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/p/${project.id}`} className={secondary}>
              Public page
              <ExternalLink className="size-4" aria-hidden />
            </Link>
            {isOwner && (
              <Link href={`/projects/${project.id}/manage`} className={secondary}>
                Manage
              </Link>
            )}
            {isOwner && project.status === "ACTIVE" && (
              <Link href={`/projects/${project.id}/submit`} className={primary}>
                <Camera className="size-[18px]" aria-hidden />
                Submit evidence
              </Link>
            )}
          </div>
        </header>

        {sites.length > 0 && (
          <section aria-label="The site on the map" className="rise-in" style={rise(1)}>
            <SitesMap sites={sites} focusId={project.id} className="lift h-[360px] sm:h-[460px]" />
            <p className="mt-3 text-[14px] text-field-muted">
              {project.exact ? "The exact boundary: your organisation sees it because it owns or reviews this site. The public sees only an approximate area." : "The approximate area, as the public sees it."}
            </p>
          </section>
        )}

        <section aria-labelledby="subs" className="rise-in space-y-5" style={rise(2)}>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="subs" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
              Submissions
            </h2>
            <span className="text-[14px] text-field-muted tabular-nums">{formatCount(submissions.length)} in all</span>
          </div>

          {submissions.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="By status">
              {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
                <li key={s} className="inline-flex items-center gap-2 rounded-full border border-field-hairline bg-field-canopy px-3 py-1.5 text-[14px]">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                  {STATUS_META[s].label}
                  <span className="font-medium tabular-nums">{formatCount(counts.get(s) ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}

          {submissions.length === 0 ? (
            <div className="space-y-4 rounded-2xl border border-field-hairline bg-field-canopy p-10 text-center">
              <Camera className="mx-auto size-7 text-field-muted" aria-hidden />
              <p className="text-[17px]">No evidence yet</p>
              <p className="mx-auto max-w-[46ch] text-[15px] text-field-muted">A submission is a before and after photo of the same spot. The checks run as soon as both are uploaded.</p>
              {isOwner && project.status === "ACTIVE" && (
                <Link href={`/projects/${project.id}/submit`} className={primary}>
                  Submit the first pair
                </Link>
              )}
            </div>
          ) : (
            <div className="lift overflow-hidden rounded-2xl border border-field-hairline bg-field-canopy">
              <ul className="divide-y divide-field-hairline">
                {submissions.slice(0, RECENT).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
                    <StatusBadge status={s.status} />
                    <span className="text-[15px]">Round {s.round}</span>
                    <time className="text-[14px] tabular-nums text-field-muted" dateTime={s.submittedAt.toISOString()}>
                      {s.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </time>
                    <span className="font-mono text-[13px] text-field-muted">{s.id.slice(0, 8)}</span>
                    <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
                      {s.status === "NEEDS_MORE_PROOF" && isOwner && (
                        <Link href={`/projects/${project.id}/submit?supplement=${s.id}`} className="text-[14px] font-medium text-signal hover:underline">
                          Add a photo
                        </Link>
                      )}
                      {(s.status === "APPROVED" || s.status === "ANCHORED") && (
                        <Link href={`/proof/${s.id}`} className="inline-flex items-center gap-1 text-[14px] font-medium text-signal hover:underline">
                          Proof
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      )}
                      {project.access !== "public" && (
                        <Link href={`/submissions/${s.id}`} className="text-[14px] font-medium text-signal hover:underline">
                          Full record
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {submissions.length > RECENT && (
                <p className="border-t border-field-hairline px-5 py-3 text-[14px] text-field-muted">
                  The {RECENT} most recent of {formatCount(submissions.length)}.
                </p>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="where" className="rise-in max-w-[760px] space-y-4" style={rise(3)}>
          <h2 id="where" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            How the location is protected
          </h2>
          <p className="text-[16px] leading-[1.6] text-field-muted">
            The public sees only the centre of a grid cell near the site
            {project.fuzzedLocation ? ` (${formatLatLon(project.fuzzedLocation.coordinates)})` : ""}. The exact boundary is sealed with a commitment, so anyone shown it later can confirm it was not changed.
          </p>
          {project.locationCommitment && <HashDisplay hash={project.locationCommitment} variant="full" theme="field" label="Commitment" />}
          {project.exact?.locationSalt && (
            <details className="group rounded-2xl border border-field-hairline bg-field-canopy p-4">
              <summary className="cursor-pointer list-none text-[15px] font-medium [&::-webkit-details-marker]:hidden">For auditors: the salt that opens the commitment</summary>
              <div className="space-y-2 pt-3 text-[14px] text-field-muted">
                <p>Shared only with your organisation. With the exact boundary, it lets an auditor recompute the commitment above.</p>
                <HashDisplay hash={project.exact.locationSalt} variant="truncated" theme="field" label="Salt" />
              </div>
            </details>
          )}
        </section>
      </main>
    </AppShell>
  );
}
