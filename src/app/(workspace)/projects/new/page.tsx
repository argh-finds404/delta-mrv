import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { NewProjectForm } from "@/src/components/projects/NewProjectForm";
import { ACTIVITY_LABEL } from "@/src/lib/format";
import { canRunAnchoring } from "@/src/lib/org-type";
import { requireSession } from "@/src/server/auth/session";
import { myOrganisations } from "@/src/server/services/projects.service";
import { createProjectAction } from "./actions";

export const metadata: Metadata = {
  title: "New project · Delta",
  description: "Register a restoration site: what is claimed, and the boundary evidence will be checked against.",
};

export default function NewProjectPage() {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <NewProject />
    </React.Suspense>
  );
}

async function NewProject() {
  await connection();
  const session = await requireSession();
  const orgs = await myOrganisations({ userId: session.user.id });
  // the service decides who may create (createProject); this only chooses what to show
  const owning = orgs.filter((o) => o.orgType === "OWNER");

  return (
    <AppShell userName={session.user.name || session.user.email} context={orgs[0]?.orgName} review={orgs.some((o) => o.orgType === "VERIFIER") ? { count: 0 } : null} anchoring={canRunAnchoring(orgs)}>
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-10 sm:px-6 lg:py-14">
        <header className="rise-in space-y-3">
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">New project</h1>
          <p className="max-w-[68ch] text-[16px] leading-[1.6] text-field-muted">
            Register the site once. Evidence is then checked against its boundary, and reviewed by an organisation independent of yours.
          </p>
        </header>
        {owning.length ? (
          <NewProjectForm orgs={owning.map((o) => ({ id: o.orgId, name: o.orgName }))} activities={Object.entries(ACTIVITY_LABEL).map(([value, label]) => ({ value, label }))} create={createProjectAction} />
        ) : (
          <p className="max-w-[60ch] rounded-2xl border border-field-hairline bg-field-canopy p-6 text-[15px] leading-[1.6]">
            Projects belong to an organisation that does the restoration work. You are not a member of one.{" "}
            <Link href="/sign-up" className="underline underline-offset-4">
              Create an organisation
            </Link>{" "}
            to register a site.
          </p>
        )}
      </main>
    </AppShell>
  );
}
