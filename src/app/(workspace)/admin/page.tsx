import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AnchorNow } from "@/src/components/admin/AnchorNow";
import { RetryJobs } from "@/src/components/admin/RetryJobs";
import { AssignReviewer } from "@/src/components/admin/AssignReviewer";
import { MatchResolver } from "@/src/components/admin/MatchResolver";
import { TamperDemo } from "@/src/components/admin/TamperDemo";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { explorerAddress, explorerTx } from "@/src/lib/chain/registry";
import { ACTIVITY_LABEL, formatCount } from "@/src/lib/format";
import { requireSession } from "@/src/server/auth/session";
import { auditChainHealth, jobQueueHealth, unassignedProjects, verifierOrganisations } from "@/src/server/services/admin.service";
import { anchorOverview } from "@/src/server/services/anchor.service";
import { ForbiddenError } from "@/src/server/services/errors";
import { myOrganisations } from "@/src/server/services/projects.service";
import { anchorNowAction, assignReviewerAction, lookupMatchAction, resolveMatchAction, retryJobsAction, tamperDemoAction } from "./actions";

export const metadata: Metadata = {
  title: "Operations · Delta",
  description: "Anchoring, reviewer assignment, the job queue, duplicate matches and the audit chains.",
};

const STATUS = {
  PENDING: { label: "Waiting to be sent", color: "#A86400" },
  SUBMITTED: { label: "Sent, not confirmed", color: "#2C6BC4" },
  CONFIRMED: { label: "Confirmed", color: "#4F55C8" },
  FAILED: { label: "Not anchored, will retry", color: "#C8402B" },
} as const;

// what each kind of background job does, in words (a job's stored name never reaches the screen)
const JOB_LABEL: Record<string, string> = {
  "forensics.run": "Forensic checks on a submission",
  "ai.audit": "Advisory AI review of a submission",
  "drafts.sweep": "Daily sweep of abandoned drafts",
  "satellite.ndvi": "Satellite vegetation cross-check",
};

const when = (d: Date | null) => (d ? `${d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : "");
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export default function AdminPage() {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <Operations />
    </React.Suspense>
  );
}

/** /admin (docs/05-ROUTES.md §3), for operators. Anyone the service refuses gets a 404. */
async function Operations() {
  await connection();
  const session = await requireSession();
  const actor = { userId: session.user.id };
  const [overview, orgs] = await Promise.all([
    anchorOverview(actor).catch((e: unknown) => {
      if (e instanceof ForbiddenError) notFound();
      throw e;
    }),
    myOrganisations(actor),
  ]);
  const [chains, waitingProjects, queue, verifiers] = await Promise.all([auditChainHealth(actor), unassignedProjects(actor), jobQueueHealth(actor), verifierOrganisations(actor)]);
  const demoMode = process.env.DEMO_MODE === "true";
  const { waiting, unsealed, configured, batches } = overview;
  const unfinished = batches.filter((b) => b.status !== "CONFIRMED").length;
  const contract = batches[0]?.contractAddress;

  return (
    <AppShell active="operations" userName={session.user.name || session.user.email} context={orgs[0]?.orgName} review={{ count: 0 }} operator>
      <main className="mx-auto max-w-[1200px] space-y-12 px-4 py-10 sm:px-6 lg:py-14">
        <header className="rise-in space-y-3">
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">Operations</h1>
          <p className="max-w-[68ch] text-[16px] leading-[1.6] text-field-muted">
            Running the platform: anchoring, who reviews which project, background jobs, duplicate matches and the audit chains. Nothing here approves, rejects or changes a decision.
          </p>
        </header>

        <section aria-labelledby="anchoring" className="space-y-6">
        <div className="space-y-2">
          <h2 id="anchoring" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Anchoring
          </h2>
          <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
            Once a day, every newly approved record is batched into one fingerprint and that fingerprint is written to Base Sepolia. A record becomes Anchored only when the chain confirms its batch.
          </p>
        </div>

        <section aria-labelledby="waiting" className="rise-in lift grid gap-6 rounded-2xl border border-field-hairline bg-field-canopy p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="space-y-1">
            <h2 id="waiting" className="text-[15px] text-field-muted">
              Waiting for the next batch
            </h2>
            <p className="font-serif text-[44px] leading-none tabular-nums" data-testid="anchor-waiting">
              {formatCount(waiting)}
            </p>
            <p className="text-[14px] text-field-muted">
              approved {waiting === 1 ? "record" : "records"}
              {unfinished > 0 && `, and ${unfinished} unfinished ${unfinished === 1 ? "batch" : "batches"} to send again`}
            </p>
          </div>
          <AnchorNow
            action={anchorNowAction}
            disabled={!configured}
            disabledReason={configured ? undefined : "Anchoring is not configured on this server. Its environment needs the chain endpoint, the contract address and the anchor key."}
          />
          {unsealed > 0 && (
            <p className="text-[14px] text-field-muted md:col-span-2">
              {formatCount(unsealed)} approved {unsealed === 1 ? "record was" : "records were"} recorded without a sealed document and cannot be anchored.
            </p>
          )}
        </section>

        <section aria-labelledby="batches" className="rise-in space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h3 id="batches" className="font-serif text-[22px] leading-tight tracking-[-0.01em]">
              Batches
            </h3>
            {contract && (
              <a href={explorerAddress(contract)} target="_blank" rel="noreferrer" className="font-mono text-[13px] text-field-muted underline decoration-field-hairline underline-offset-4 hover:text-field-text">
                Contract {short(contract)}
              </a>
            )}
          </div>
          {batches.length === 0 ? (
            <p className="rounded-2xl border border-field-hairline bg-field-canopy p-6 text-[15px] text-field-muted">No batch has been built yet. The first one is made when an approved record is waiting and anchoring runs.</p>
          ) : (
            <div className="lift overflow-x-auto rounded-2xl border border-field-hairline bg-field-canopy">
              <table className="w-full min-w-[720px] text-left text-[14px]">
                <thead className="border-b border-field-hairline text-[13px] text-field-muted">
                  <tr>
                    {["Batch", "State", "Records", "Merkle root", "Transaction", "Built", "Confirmed"].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-hairline">
                  {batches.map((b) => (
                    <tr key={b.id} data-testid="anchor-batch" data-status={b.status}>
                      <td className="px-4 py-3 tabular-nums">{b.id}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden className="size-2 rounded-full" style={{ background: STATUS[b.status].color }} />
                          {STATUS[b.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatCount(b.leafCount)}</td>
                      <td className="px-4 py-3 font-mono text-[13px]" title={b.merkleRoot}>
                        {short(b.merkleRoot)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px]">
                        {b.txHash ? (
                          <a href={explorerTx(b.txHash)} target="_blank" rel="noreferrer" title={b.txHash} className="underline decoration-field-hairline underline-offset-4 hover:decoration-field-text">
                            {short(b.txHash)}
                          </a>
                        ) : (
                          <span className="font-sans text-field-muted">None yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-field-muted">{when(b.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-field-muted">{when(b.confirmedAt) || "Not yet"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </section>

        {/* always shown: assigning reviewers is the step a new project waits on */}
        <section aria-labelledby="unassigned" className="rise-in space-y-4">
          <h2 id="unassigned" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Projects with no reviewer
          </h2>
          {waitingProjects.length === 0 ? (
            <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
              Every project has a reviewer at the moment. A newly registered project is listed here until you assign it an independent verifier organisation.
            </p>
          ) : (
            <>
            <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
              Nothing submitted to these projects can be approved until an independent organisation reviews them. Assigning one lets that organisation&apos;s reviewers vote on the project, and is recorded on the owner&apos;s audit chain. Projects whose owners asked for a reviewer come first.
            </p>
            <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
              {waitingProjects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-[13px] text-field-muted">
                      {ACTIVITY_LABEL[p.activityType] ?? p.activityType} · {p.ownerOrgName}
                      {p.requestedAt && <span className="text-review"> · reviewer asked for {when(p.requestedAt)}</span>}
                    </p>
                  </div>
                  <AssignReviewer projectId={p.id} verifiers={verifiers} action={assignReviewerAction} />
                </li>
              ))}
            </ul>
            </>
          )}
        </section>

        <section aria-labelledby="jobs" className="rise-in space-y-4">
          <h2 id="jobs" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Background jobs
          </h2>
          <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
            The forensic checks and the advisory AI review run in a queue after a submission is sent. A job that fails is tried again, five attempts in all, then stops and is listed here.
          </p>
          <dl className="grid max-w-[720px] grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Waiting", queue.counts.PENDING],
                ["Running", queue.counts.RUNNING],
                ["Failed", queue.counts.FAILED],
                ["Stuck", queue.counts.STUCK],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-2xl border border-field-hairline bg-field-canopy px-4 py-3">
                <dt className="text-[13px] text-field-muted">{label}</dt>
                <dd className="font-serif text-[28px] leading-tight tabular-nums" data-testid={`jobs-${label.toLowerCase()}`}>
                  {formatCount(n)}
                </dd>
              </div>
            ))}
          </dl>
          {queue.halted.length === 0 ? (
            <p className="text-[15px] text-field-muted">No job has stopped. Nothing needs a retry.</p>
          ) : (
            <>
              <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
                {queue.halted.map((j) => (
                  <li key={j.id} className="space-y-1 px-5 py-3.5 text-[14px]">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-medium">{JOB_LABEL[j.kind] ?? "Background job"}</span>
                      <span className="text-[13px] text-field-muted">
                        {j.status === "STUCK" ? "Stuck: its worker stopped mid-run" : "Failed"} after {formatCount(j.attempts)} {j.attempts === 1 ? "attempt" : "attempts"} · queued {when(j.createdAt)}
                      </span>
                    </p>
                    {j.lastError && <p className="break-words font-mono text-[13px] text-field-muted">{j.lastError.slice(0, 300)}</p>}
                  </li>
                ))}
              </ul>
              <RetryJobs action={retryJobsAction} />
            </>
          )}
        </section>

        <section aria-labelledby="matches" className="rise-in space-y-4">
          <h2 id="matches" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Duplicate matches
          </h2>
          <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
            A finding that matches another organisation&apos;s photo names it only by a match reference, so reviewers never learn whose it is. Paste one here to see both sides, then record whether it is a reuse. The record changes no finding, score or decision; the reviewers read it beside the finding.
          </p>
          <MatchResolver lookup={lookupMatchAction} resolve={resolveMatchAction} />
        </section>

        <section aria-labelledby="chains" className="rise-in space-y-4">
          <h2 id="chains" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Audit chains
          </h2>
          <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
            Every organisation has its own chain of events, each one fingerprinted together with the one before it. Verified just now, from the first event to the last.
          </p>
          {chains.length === 0 ? (
            <p className="rounded-2xl border border-field-hairline bg-field-canopy p-6 text-[15px] text-field-muted">No audit events have been written yet.</p>
          ) : (
            <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
              {chains.map((c) => (
                <li key={c.orgId} data-testid="audit-chain" data-ok={String(c.ok)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[15px]">
                  <span className="font-medium">{c.orgName}</span>
                  <span className="tabular-nums text-field-muted">
                    {formatCount(c.events)} {c.events === 1 ? "event" : "events"}
                  </span>
                  <span className="inline-flex items-center gap-2" style={{ color: c.ok ? "#1A7A51" : "#C8402B" }}>
                    <span aria-hidden className="size-2 rounded-full bg-current" />
                    {c.ok ? "Verifies" : `Broken at event ${c.firstBadSeq}: ${c.reason}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {demoMode && chains.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-[16px] font-medium">What tampering looks like</h3>
              <p className="max-w-[68ch] text-[14px] leading-[1.6] text-field-muted">
                The database refuses to edit an audit event, so this changes one event in a copy of a real chain and verifies both. Nothing stored is touched.
              </p>
              <TamperDemo action={tamperDemoAction} />
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
