import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { JoinInvitation } from "@/src/components/app/JoinInvitation";
import { OrgPeople } from "@/src/components/app/OrgPeople";
import { PendingSyncBanner } from "@/src/components/app/PendingSyncBanner";
import { SubmitEvidenceMenu } from "@/src/components/app/SubmitEvidenceMenu";
import { SitesMap } from "@/src/components/app/SitesMap";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { activityColor } from "@/src/lib/activity";
import { ACTIVITY_LABEL, formatClaim, formatCount } from "@/src/lib/format";
import { isOperator } from "@/src/server/services/operators";
import { STATUS_META, STATUS_ORDER } from "@/src/lib/status";
import { requireSession } from "@/src/server/auth/session";
import { listApiKeys } from "@/src/server/services/api-key.service";
import { myFunderPortfolio } from "@/src/server/services/funder.service";
import { listProjects, myOrganisations } from "@/src/server/services/projects.service";
import { reviewQueueOverview } from "@/src/server/services/reviews.service";
import { countSubmissionsByStatus, listSubmissionsForProject } from "@/src/server/services/submissions.service";
import { workspaceSites } from "../sites";
import { FunderSection } from "./FunderSection";

export const metadata: Metadata = {
  title: "Overview · Delta",
  description: "What needs your attention, where your sites are, and where every submission stands.",
};

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;
const primary =
  "inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

// Read at request time (cacheComponents): the body streams inside Suspense.
export default function DashboardPage({ searchParams }: { searchParams?: Promise<{ invite?: string }> }) {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <Dashboard searchParams={searchParams} />
    </React.Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams?: Promise<{ invite?: string }> }) {
  await connection();
  const session = await requireSession();
  const actor = { userId: session.user.id };
  const invite = (await searchParams)?.invite; // the far end of an invitation link (docs/16 A14)

  // no .catch: a failed read must reach the error boundary, not render as an all-clear dashboard
  const [queue, projects, counts, orgs, funded] = await Promise.all([reviewQueueOverview(actor), listProjects(actor), countSubmissionsByStatus(actor), myOrganisations(actor), myFunderPortfolio(actor)]);
  const keys = funded ? (await listApiKeys(actor)).filter((k) => k.orgId === funded.orgId) : [];
  const mine = projects.filter((p) => p.access !== "public");
  const owned = mine.filter((p) => p.access === "owner");
  const sites = await workspaceSites(session.user.id, mine);

  const needsMoreProof = counts.NEEDS_MORE_PROOF
    ? (await Promise.all(owned.map((p) => listSubmissionsForProject(actor, p.id)))).flat().filter((s) => s.status === "NEEDS_MORE_PROOF")
    : [];
  const titleOf = new Map(projects.map((p) => [p.id, p.title]));

  const isVerifier = queue.isVerifier;
  const isOwner = owned.length > 0;
  const org = orgs[0];
  const manages = orgs.find((o) => o.role === "owner" || o.role === "admin");
  const firstName = (session.user.name || session.user.email).split(/[\s@]/)[0];
  const total = STATUS_ORDER.reduce((n, s) => n + counts[s], 0);
  const highCount = queue.items.filter((i) => i.findingCounts.high > 0).length;
  const operator = await isOperator(actor);
  const openForEvidence = owned.filter((p) => p.status === "ACTIVE").map((p) => ({ id: p.id, title: p.title }));

  return (
    <AppShell active="overview" userName={session.user.name || session.user.email} context={org?.orgName} review={isVerifier ? { count: queue.total } : null} operator={operator}>
      <main className="mx-auto max-w-[1200px] space-y-12 px-4 py-10 sm:px-6 lg:py-14">
        {isOwner && <PendingSyncBanner projects={owned.map((p) => ({ id: p.id, title: p.title }))} />}

        {/* Greeting and the one next action */}
        <header className="rise-in flex flex-wrap items-end justify-between gap-6" style={rise(0)}>
          <div className="space-y-2">
            {org && <p className="text-[15px] text-field-muted">{org.orgName}</p>}
            <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">Welcome back, {firstName}</h1>
          </div>
          {isVerifier ? (
            <Link href="/lab" className={primary}>
              <ShieldCheck className="size-[18px]" aria-hidden />
              Review {formatCount(queue.total)} waiting
            </Link>
          ) : isOwner ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/projects/new" className="inline-flex h-11 items-center rounded-xl border border-field-hairline bg-field-canopy px-4 text-[15px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                New project
              </Link>
              {openForEvidence.length > 0 && <SubmitEvidenceMenu projects={openForEvidence} />}
            </div>
          ) : orgs.some((o) => o.orgType === "OWNER") ? (
            <Link href="/projects/new" className={primary}>
              Register your first project
            </Link>
          ) : null}
        </header>

        {typeof invite === "string" && <JoinInvitation invitationId={invite} signedInAs={session.user.email} />}

        {/* A new organisation: what this page will hold, and the one step that fills it (docs/15 §2) */}
        {org && mine.length === 0 && !funded && (
          <section className="rise-in max-w-[640px] space-y-3 rounded-2xl border border-field-hairline bg-field-canopy p-8" style={rise(1)}>
            <h2 className="font-serif text-[28px] leading-tight">{isVerifier ? "Nothing to review yet" : "No projects yet"}</h2>
            <p className="text-[15px] leading-[1.6] text-field-muted">
              {isVerifier
                ? "Your organisation reviews the projects a Delta operator assigns to it, and none has been assigned yet. Once one is, its submissions arrive in Review."
                : "Your sites, and where each submission stands, appear here. Register a site and draw its boundary, then submit a before and an after photo of it."}
            </p>
            {isVerifier && operator && (
              <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-sm text-[15px] font-medium text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                Assign projects to reviewers
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </section>
        )}

        {funded && <FunderSection portfolio={funded} keys={keys} />}

        {sites.length > 0 && (
          <section aria-label="Your sites on the map" className="rise-in" style={rise(1)}>
            <SitesMap sites={sites} className="lift h-[340px] sm:h-[420px]" />
          </section>
        )}

        {/* Where every submission stands: real counts, one colour per state */}
        {total > 0 && (
          <section aria-labelledby="where" className="rise-in space-y-5" style={rise(2)}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="where" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
                Where submissions stand
              </h2>
              <span className="text-[14px] text-field-muted tabular-nums">{formatCount(total)} in all</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-field-raised" aria-hidden>
              {STATUS_ORDER.filter((s) => counts[s]).map((s, i) => (
                <span key={s} className="grow-x h-full" style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_META[s].color, ...rise(i) }} />
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {STATUS_ORDER.filter((s) => counts[s] || ["IN_REVIEW", "APPROVED", "NEEDS_MORE_PROOF"].includes(s)).map((s) => (
                <div key={s} className="lift flex flex-col-reverse gap-1 rounded-2xl border border-field-hairline bg-field-canopy p-4">
                  <dt className="inline-flex items-center gap-2 text-[13px] text-field-muted">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                    {STATUS_META[s].label}
                  </dt>
                  <dd className="font-serif text-[30px] leading-none tabular-nums">{formatCount(counts[s])}</dd>
                </div>
              ))}
            </dl>
            {counts.ANCHORED === 0 && counts.APPROVED > 0 && (
              <p className="text-[14px] text-field-muted">Approved records are anchored on chain together, in the next daily batch.</p>
            )}
          </section>
        )}

        {/* What needs this person */}
        {(needsMoreProof.length > 0 || (isVerifier && queue.items.length > 0)) && (
          <section aria-labelledby="attention" className="rise-in space-y-4" style={rise(3)}>
            <h2 id="attention" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
              Needs your attention
            </h2>
            <ul className="space-y-3">
              {needsMoreProof.slice(0, 4).map((s) => (
                <li key={s.id} className="lift flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-field-hairline border-l-4 bg-field-canopy p-4 pl-5" style={{ borderLeftColor: STATUS_META.NEEDS_MORE_PROOF.color }}>
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{titleOf.get(s.projectId) ?? "A project"}</p>
                    <p className="text-[14px] text-field-muted">
                      A reviewer asked for more proof on round {s.round}, submitted {s.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-4">
                    <Link href={`/submissions/${s.id}`} className="rounded-sm text-[15px] font-medium text-signal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                      Read the reason
                    </Link>
                    <Link href={`/projects/${s.projectId}/submit?supplement=${s.id}`} className={primary}>
                      Add a photo
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </span>
                </li>
              ))}
              {isVerifier &&
                queue.items.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/lab?s=${item.id}`}
                      className="lift lift-hover flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-field-hairline bg-field-canopy p-4 pl-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                    >
                      <span className="min-w-0 space-y-1">
                        <span className="block font-medium">{item.projectTitle}</span>
                        <span className="block text-[14px] text-field-muted">
                          {item.ownerOrgName} · round {item.round}
                          {item.findingCounts.high > 0 && <span className="text-fraud"> · {item.findingCounts.high} high finding{item.findingCounts.high === 1 ? "" : "s"}</span>}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <StatusBadge status={item.status} />
                        <ArrowRight className="size-4 text-field-muted" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
            {isVerifier && highCount > 0 && <p className="text-[14px] text-field-muted">{highCount} in your queue carry a high-severity finding. The queue lists them first.</p>}
          </section>
        )}

        {/* The projects */}
        {mine.length > 0 && (
          <section aria-labelledby="projects" className="rise-in space-y-5" style={rise(4)}>
            <h2 id="projects" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
              {isOwner ? "Your projects" : "Projects you review"}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((p) => {
                const hue = activityColor(p.activityType);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="lift lift-hover group flex h-full flex-col overflow-hidden rounded-2xl border border-field-hairline bg-field-canopy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                    >
                      <span aria-hidden className="h-1.5" style={{ background: hue }} />
                      <span className="flex flex-1 flex-col gap-3 p-5">
                        <span className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 font-medium" style={{ color: hue, background: `color-mix(in srgb, ${hue} 12%, white)` }}>
                            {ACTIVITY_LABEL[p.activityType]}
                          </span>
                          <span className="text-field-muted">{p.access === "owner" ? "Your organisation" : "You review"}</span>
                        </span>
                        <span className="font-serif text-[22px] leading-[1.15]">{p.title}</span>
                        <span className="text-[15px] text-field-muted">{formatClaim(p.claimedQuantity, p.claimedUnit) ?? "No quantity claimed"}</span>
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-medium text-signal">
                          Open project
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {orgs.length === 0 && typeof invite !== "string" && (
          <section className="rise-in mx-auto max-w-[560px] space-y-4 rounded-2xl border border-field-hairline bg-field-canopy p-8 text-center" style={rise(1)}>
            <h2 className="font-serif text-[28px] leading-tight">You are not in an organisation yet</h2>
            <p className="text-[15px] leading-[1.6] text-field-muted">
              Projects, submissions and reviews all belong to an organisation. Ask an owner of yours to add you, or explore the public atlas meanwhile.
            </p>
            <Link href="/atlas" className={primary}>
              Explore the atlas
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>
        )}

        {/* Who is in the organisation, for those who may bring people in (the auth service checks again) */}
        {manages && <OrgPeople orgId={manages.orgId} orgName={manages.orgName} orgType={manages.orgType} />}
      </main>
    </AppShell>
  );
}
