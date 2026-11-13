import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AnchorNow } from "@/src/components/admin/AnchorNow";
import { TakeOnReview } from "@/src/components/admin/TakeOnReview";
import { TamperDemo } from "@/src/components/admin/TamperDemo";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { explorerAddress, explorerTx } from "@/src/lib/chain/registry";
import { ACTIVITY_LABEL, formatCount } from "@/src/lib/format";
import { requireSession } from "@/src/server/auth/session";
import { auditChainHealth, unassignedProjects } from "@/src/server/services/admin.service";
import { anchorOverview } from "@/src/server/services/anchor.service";
import { ForbiddenError } from "@/src/server/services/errors";
import { myOrganisations } from "@/src/server/services/projects.service";
import { anchorNowAction, takeOnReviewAction, tamperDemoAction } from "./actions";

export const metadata: Metadata = {
  title: "Anchoring · Delta",
  description: "Approved records waiting for the next batch, and every batch sent to the chain.",
};

const STATUS = {
  PENDING: { label: "Waiting to be sent", color: "#A86400" },
  SUBMITTED: { label: "Sent, not confirmed", color: "#2C6BC4" },
  CONFIRMED: { label: "Confirmed", color: "#4F55C8" },
  FAILED: { label: "Not anchored, will retry", color: "#C8402B" },
} as const;

const when = (d: Date | null) => (d ? `${d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : "");
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export default function AdminPage() {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <Anchoring />
    </React.Suspense>
  );
}

/** The anchor panel of /admin (docs/05-ROUTES.md §3). Anyone the service refuses gets a 404. */
async function Anchoring() {
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
  const [chains, waitingProjects] = await Promise.all([auditChainHealth(actor), unassignedProjects(actor)]);
  const demoMode = process.env.DEMO_MODE === "true";
  const { waiting, unsealed, configured, batches } = overview;
  const unfinished = batches.filter((b) => b.status !== "CONFIRMED").length;
  const contract = batches[0]?.contractAddress;

  return (
    <AppShell active="anchoring" userName={session.user.name || session.user.email} context={orgs[0]?.orgName} review={{ count: 0 }} anchoring>
      <main className="mx-auto max-w-[1200px] space-y-12 px-4 py-10 sm:px-6 lg:py-14">
        <header className="rise-in space-y-3">
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">Anchoring</h1>
          <p className="max-w-[68ch] text-[16px] leading-[1.6] text-field-muted">
            Once a day, every newly approved record is batched into one fingerprint and that fingerprint is written to Base Sepolia. A record becomes Anchored only when the chain confirms its batch. Anchoring changes no decision.
          </p>
        </header>

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
            <h2 id="batches" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
              Batches
            </h2>
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

        {/* always shown: a new verifier organisation is sent here to find its first project */}
        <section aria-labelledby="unassigned" className="rise-in space-y-4">
          <h2 id="unassigned" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Projects with no reviewer
          </h2>
          {waitingProjects.length === 0 ? (
            <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
              Every project has a reviewer at the moment. A newly registered project is listed here until an independent organisation takes it on.
            </p>
          ) : (
            <>
            <p className="max-w-[68ch] text-[15px] leading-[1.6] text-field-muted">
              Nothing submitted to these projects can be approved until an independent organisation reviews them. Taking one on lets your organisation&apos;s reviewers vote on it, and is recorded on the owner&apos;s audit chain.
            </p>
            <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
              {waitingProjects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-[13px] text-field-muted">
                      {ACTIVITY_LABEL[p.activityType] ?? p.activityType} · {p.ownerOrgName}
                    </p>
                  </div>
                  <TakeOnReview projectId={p.id} action={takeOnReviewAction} />
                </li>
              ))}
            </ul>
            </>
          )}
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
