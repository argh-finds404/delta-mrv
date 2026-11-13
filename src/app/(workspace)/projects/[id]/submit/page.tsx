import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SubmitWizard } from "@/src/components/submit/SubmitWizard";
import { env } from "@/src/env";
import { requireSession } from "@/src/server/auth/session";
import { NotFoundError } from "@/src/server/services/errors";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { getProject, myOrganisations } from "@/src/server/services/projects.service";

interface SubmitPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ supplement?: string }>;
}

export const metadata: Metadata = {
  title: "Submit evidence · Delta",
  description: "Send a before and after photo pair for a project site.",
};

export default function SubmitEvidencePage({ params, searchParams }: SubmitPageProps) {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <SubmitPageBody params={params} searchParams={searchParams} />
    </React.Suspense>
  );
}

async function SubmitPageBody({ params, searchParams }: SubmitPageProps) {
  await connection();
  const session = await requireSession();
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const supplementSubmissionId = typeof sp.supplement === "string" ? sp.supplement : undefined;

  // The caller's own project, or nothing: the server decides who may submit (createDraft), and
  // a project the caller cannot see is a 404 here too, never a placeholder.
  const project = await getProject({ userId: session.user.id }, id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });

  const orgs = await myOrganisations({ userId: session.user.id });
  return (
    <AppShell userName={session.user.name || session.user.email} context={orgs[0]?.orgName}>
      <main className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 lg:py-12">
        <SubmitWizard
          projectId={project.id}
          projectTitle={project.title}
          activityType={project.activityType}
          supplementSubmissionId={supplementSubmissionId}
          isDemoMode={Boolean(env.DEMO_MODE)}
        />
      </main>
    </AppShell>
  );
}
