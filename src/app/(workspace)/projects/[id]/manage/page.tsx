import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { ManageProjectForm } from "@/src/components/projects/ManageProjectForm";
import { RequestReviewer } from "@/src/components/projects/RequestReviewer";
import { isOperator } from "@/src/server/services/operators";
import { requireSession } from "@/src/server/auth/session";
import { NotFoundError } from "@/src/server/services/errors";
import { getProject, listProjectReviewers, myOrganisations, reviewerRequestedAt } from "@/src/server/services/projects.service";
import { listSubmissionsForProject } from "@/src/server/services/submissions.service";
import { requestReviewerAction, updateProjectAction } from "./actions";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Manage project · Delta",
  description: "Change a project's details, see who reviews it, or close it.",
};

export default function ManageProjectPage({ params }: Props) {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <ManageBody params={params} />
    </React.Suspense>
  );
}

async function ManageBody({ params }: Props) {
  await connection();
  const session = await requireSession();
  const { id } = await params;
  const actor = { userId: session.user.id };

  const project = await getProject(actor, id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  // the owning organisation only (docs/05-ROUTES.md §3); to anyone else this page does not exist
  if (project.access !== "owner") notFound();
  const [orgs, submissions, reviewers, requestedAt] = await Promise.all([myOrganisations(actor), listSubmissionsForProject(actor, id), listProjectReviewers(actor, id), reviewerRequestedAt(actor, id)]);
  const role = orgs.find((o) => o.orgId === project.ownerOrgId)?.role;
  const mayChange = role === "owner" || role === "admin"; // the service checks again on every save
  const locked = submissions.some((s) => s.status !== "DRAFT");

  return (
    <AppShell userName={session.user.name || session.user.email} context={orgs[0]?.orgName} review={orgs.some((o) => o.orgType === "VERIFIER") ? { count: 0 } : null} operator={await isOperator({ userId: session.user.id })}>
      <main className="mx-auto max-w-[1200px] space-y-10 px-4 py-8 sm:px-6 lg:py-12">
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 rounded-sm text-[14px] text-field-muted transition-colors hover:text-field-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
          <ArrowLeft className="size-4" aria-hidden />
          {project.title}
        </Link>

        <header className="rise-in space-y-3">
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">Manage the project</h1>
          <p className="max-w-[68ch] text-[16px] leading-[1.6] text-field-muted">
            The boundary and the organisation that owns the project never change: the public commitment to the site depends on them.
          </p>
        </header>

        <section aria-labelledby="reviewers" className="rise-in max-w-[640px] space-y-3">
          <h2 id="reviewers" className="font-serif text-[24px] leading-tight">
            Who reviews it
          </h2>
          {reviewers.length > 0 ? (
            <>
              <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
                {reviewers.map((name) => (
                  <li key={name} className="px-5 py-3 text-[15px] font-medium">
                    {name}
                  </li>
                ))}
              </ul>
              <p className="text-[14px] leading-[1.6] text-field-muted">An independent organisation: nobody in yours can vote on this project. Its name is shown on the public project page.</p>
            </>
          ) : (
            <div className="space-y-4 rounded-2xl border border-field-hairline bg-field-canopy p-5">
              <p className="text-[15px] leading-[1.6]">
                No organisation reviews this project yet.{" "}
                <span className="text-field-muted">
                  Evidence can be sent and is checked automatically, but nothing can be approved until a Delta operator assigns an independent verifier organisation. Your organisation cannot choose its
                  own reviewer.
                </span>
              </p>
              {project.status === "ACTIVE" && <RequestReviewer requestedAt={requestedAt} canAsk={mayChange} action={requestReviewerAction.bind(null, project.id)} />}
            </div>
          )}
        </section>

        <section aria-labelledby="details" className="rise-in space-y-5">
          <h2 id="details" className="font-serif text-[24px] leading-tight">
            Details
          </h2>
          {mayChange ? (
            <ManageProjectForm
              project={{ title: project.title, description: project.description, claimedQuantity: project.claimedQuantity, claimedUnit: project.claimedUnit, toleranceMeters: project.toleranceMeters, status: project.status }}
              locked={locked}
              save={updateProjectAction.bind(null, project.id)}
            />
          ) : (
            <p className="max-w-[60ch] rounded-2xl border border-field-hairline bg-field-canopy p-5 text-[15px] leading-[1.6]">
              Only an owner or an administrator of your organisation can change a project or close it.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
