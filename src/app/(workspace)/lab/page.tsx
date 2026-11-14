import * as React from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { isOperator } from "@/src/server/services/operators";
import { requireSession } from "@/src/server/auth/session";
import { myOrganisations } from "@/src/server/services/projects.service";
import { LabWorkspace } from "./LabWorkspace";

export const metadata: Metadata = {
  title: "Review · Delta",
  description: "The evidence, its findings, and your written decision, one submission at a time.",
};

export default function ReviewPage() {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <Review />
    </React.Suspense>
  );
}

async function Review() {
  await connection();
  const session = await requireSession();
  const orgs = await myOrganisations({ userId: session.user.id });
  return (
    <AppShell active="review" userName={session.user.name || session.user.email} context={orgs[0]?.orgName} review={{ count: 0 }} operator={await isOperator({ userId: session.user.id })} fill>
      <LabWorkspace />
    </AppShell>
  );
}
