import * as React from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { SubmitWizard } from "@/src/components/submit/SubmitWizard";
import { requireSession } from "@/src/server/auth/session";
import { getProject, getPublicProject } from "@/src/server/services/projects.service";

interface SubmitPageProps {
  params: Promise<{ id: string }>;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const metadata: Metadata = {
  title: "Evidence Intake · Delta",
  description: "Mobile-first before/after photographic pair intake with client-side hashing.",
};

export default function SubmitEvidencePage({ params }: SubmitPageProps) {
  return (
    <React.Suspense fallback={<div className="min-h-dvh bg-field-abyss" aria-busy />}>
      <SubmitPageBody params={params} />
    </React.Suspense>
  );
}

async function SubmitPageBody({ params }: SubmitPageProps) {
  await connection();
  const session = await requireSession();
  const { id } = await params;

  let projectTitle = "Sundarbans Ecological Corridor";
  let activityType = "MANGROVE";

  if (isUuid(id)) {
    try {
      const publicProject = await getPublicProject(id);
      projectTitle = publicProject.title;
      activityType = publicProject.activityType;
    } catch {
      try {
        const ownerProject = await getProject({ userId: session.user.id }, id);
        projectTitle = ownerProject.title;
        activityType = ownerProject.activityType;
      } catch {
        // Fallback to fixture values for Stage 4d prototyping before backend intake lands
      }
    }
  }

  return (
    <div data-theme="field" className="min-h-screen bg-field-abyss text-field-text font-sans">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <SubmitWizard
          projectId={id}
          projectTitle={projectTitle}
          activityType={activityType}
        />
      </main>
    </div>
  );
}

