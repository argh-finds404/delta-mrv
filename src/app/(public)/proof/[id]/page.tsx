import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { ComplianceExport, DropPhotoVerifier, ProofVerifier } from "@/src/components/proof";
import { CaptureCheck } from "@/src/components/proof/CaptureCheck";
import { CustodyTimeline } from "@/src/components/proof/CustodyTimeline";
import { SurvivalTimeline } from "@/src/components/proof/SurvivalTimeline";
import { env } from "@/src/env";
import { SiteFooter } from "@/src/components/site/SiteFooter";
import { SiteHeader } from "@/src/components/site/SiteHeader";
import { ACTIVITY_LABEL, formatClaim, formatLatLon } from "@/src/lib/format";
import { explorerAddress, explorerTx } from "@/src/lib/chain/registry";
import { DOES_NOT_PROVE, PROVES } from "@/src/lib/limits";
import { buildProofBundle } from "@/src/lib/proof-bundle";
import { projectSurvival } from "@/src/server/services/checkups.service";
import { NotFoundError } from "@/src/server/services/errors";
import { getPublicProof, type PublicProof } from "@/src/server/services/submissions.service";

interface ProofPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Proof · Delta",
  description: "An approved restoration submission: its files' fingerprints, every review decision, and what the record does not prove.",
};

const container = "mx-auto max-w-[920px] px-6 lg:px-10";
const DECISION_LABEL = { APPROVE: "Approved", REJECT: "Rejected", REQUEST_MORE_PROOF: "Asked for more proof" } as const;
const ROLE_LABEL = { BEFORE: "Before", AFTER: "After", SUPPLEMENT: "Supplement" } as const;
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateTime = (d: Date) => `${d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;

/** The proof dossier (docs/05-ROUTES.md §4). Every value on it is a stored row; nothing is asserted. */
export default function ProofDossierPage({ params }: ProofPageProps) {
  return (
    <div data-theme="paper" className="min-h-dvh bg-paper font-sans text-paper-ink">
      <SiteHeader />
      <React.Suspense fallback={<main className={`${container} min-h-[60vh] py-16`} aria-busy />}>
        <Dossier params={params} />
      </React.Suspense>
      <SiteFooter />
    </div>
  );
}

async function Dossier({ params }: ProofPageProps) {
  await connection();
  const { id } = await params;
  const proof = await getPublicProof(id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { submission, project, files, decisions, manifest, anchor, capture } = proof;
  const claim = formatClaim(project.claimedQuantity, project.claimedUnit);
  // survival: the record this page belongs to (itself, or the one a check-up revisits)
  const recordId = submission.followsSubmissionId ?? submission.id;
  const survival = await projectSurvival(project.id, { limit: 50 });
  const record = survival.records.find((r) => r.recordId === recordId);
  const bundle =
    manifest && submission.manifestHash
      ? buildProofBundle(
          {
            submissionId: submission.id,
            project: { id: project.id, title: project.title, ownerOrgName: project.ownerOrgName },
            claim,
            checkupOf: submission.followsSubmissionId,
            manifest,
            manifestHash: submission.manifestHash,
            anchor: anchor && { chainId: anchor.chainId, contractAddress: anchor.contractAddress, batchId: anchor.batchId, merkleRoot: anchor.merkleRoot, proof: anchor.proof, txHash: anchor.txHash, blockNumber: anchor.blockNumber, status: anchor.status },
            capture,
            decisions: decisions.map((d) => ({ decision: d.decision, reason: d.reason, round: d.round, createdAt: d.createdAt.toISOString(), reviewerOrgName: d.reviewerOrgName })),
          },
          `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/proof/${submission.id}`,
        )
      : null;

  return (
    <main className={`${container} space-y-16 py-12 lg:py-16`}>
      {/* 1. Header */}
      <header className="space-y-6">
        <p className="text-[15px] text-paper-muted">
          {submission.followsSubmissionId ? "Proof of an approved survival check-up" : "Proof of an approved submission"} · {ACTIVITY_LABEL[project.activityType] ?? project.activityType}
        </p>
        <h1 className="type-display">{project.title}</h1>
        <dl className="grid gap-x-10 gap-y-4 border-y border-paper-rule py-5 text-[15px] sm:grid-cols-3">
          <div>
            <dt className="text-paper-muted">Claimed by</dt>
            <dd className="mt-1">{project.ownerOrgName}</dd>
          </div>
          <div>
            <dt className="text-paper-muted">What they claim</dt>
            <dd className="mt-1">{claim ?? "No quantity stated"}</dd>
          </div>
          <div>
            <dt className="text-paper-muted">Submitted</dt>
            <dd className="mt-1">{date(submission.submittedAt)}</dd>
          </div>
        </dl>
        <p className="max-w-[60ch] text-[15px] leading-[1.6] text-paper-muted">
          The claim is the organisation&apos;s own. This page shows what was checked about the evidence for it, and by whom.
        </p>
      </header>

      {record && (submission.followsSubmissionId || survival.checkupMonths || record.visits.length > 0) && (
        <section aria-labelledby="survival" className="space-y-4">
          <h2 id="survival" className="type-section">
            Is it still there?
          </h2>
          <p className="max-w-[62ch] text-[15px] leading-[1.6] text-paper-muted">
            {submission.followsSubmissionId
              ? "This check-up photographed the spot of an approved record again, and was reviewed the same way. Each visit is its own record, checked and anchored like this one."
              : "The site's owner photographs this spot again on a schedule, and each visit is reviewed by the same independent organisation. A missed visit is shown as missed."}
          </p>
          <SurvivalTimeline record={record} checkupMonths={survival.checkupMonths} currentId={submission.id} />
        </section>
      )}

      <CustodyTimeline files={files} decisions={decisions} anchor={anchor} capture={capture ? "Signed by the capturing device's key" : undefined} />

      {/* 2. Verification state: computed in the visitor's browser, never asserted by the server */}
      <section aria-labelledby="state" className="space-y-4">
        <h2 id="state" className="type-section">
          Has this record changed?
        </h2>
        {manifest ? (
          <ProofVerifier manifest={manifest} anchor={anchor} />
        ) : (
          <div className="flex flex-wrap items-start gap-4 rounded-xl border border-paper-rule bg-paper-card p-5">
            <span className="rounded-md border border-paper-rule px-2.5 py-1 font-mono text-[13px] text-paper-muted">PENDING</span>
            <p className="max-w-[62ch] flex-1 text-[15px] leading-[1.6]">
              Two independent reviewers approved this submission, but it was recorded without the sealed document that anchoring needs, so it cannot be compared against a chain. You can still check a photo against the fingerprints below.
            </p>
          </div>
        )}
      </section>

      {/* 3. Evidence */}
      <section aria-labelledby="evidence" className="space-y-5">
        <h2 id="evidence" className="type-section">
          The evidence, by fingerprint
        </h2>
        <p className="max-w-[62ch] text-[15px] leading-[1.6] text-paper-muted">
          Originals stay in private storage. Each file&apos;s SHA-256 was computed by the server from the stored bytes, not taken from the uploader.
        </p>
        <CaptureCheck projectId={project.id} files={files} capture={capture} />
        <ul className="divide-y divide-paper-rule border-y border-paper-rule">
          {files.map((f) => (
            <li key={f.id} className="grid gap-2 py-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
              <span className="text-[15px]">
                {ROLE_LABEL[f.role]}
                {f.round > 1 && <span className="text-paper-muted"> · round {f.round}</span>}
              </span>
              <HashDisplay hash={f.sha256} variant="full" theme="paper" label="SHA-256" />
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Drop the original photo */}
      <section aria-label="Check a photo">
        <DropPhotoVerifier evidenceFiles={files} theme="paper" />
      </section>

      {/* 5. Decision record */}
      <section aria-labelledby="decisions" className="space-y-5">
        <h2 id="decisions" className="type-section">
          Who reviewed it, and why
        </h2>
        <p className="max-w-[62ch] text-[15px] leading-[1.6] text-paper-muted">
          Reviewers come from an organisation independent of {project.ownerOrgName}. Every decision carries a written reason, and none can be edited or deleted.
        </p>
        <ol className="space-y-4">
          {decisions.map((d, i) => (
            <li key={i} className="rounded-xl border border-paper-rule bg-paper-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <span className="text-[16px] font-medium">
                  {DECISION_LABEL[d.decision]} <span className="font-normal text-paper-muted">by a reviewer at {d.reviewerOrgName}</span>
                </span>
                <time className="text-[14px] tabular-nums text-paper-muted" dateTime={d.createdAt.toISOString()}>
                  {dateTime(d.createdAt)}
                  {d.round > 1 && ` · round ${d.round}`}
                </time>
              </div>
              <blockquote className="mt-3 border-l-2 border-paper-rule pl-4 font-serif text-[18px] leading-[1.5]">{d.reason}</blockquote>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. Location */}
      <Location project={project} />

      {/* 7. Chain anchor */}
      <section aria-labelledby="anchor" className="space-y-4">
        <h2 id="anchor" className="type-section">
          Chain anchor
        </h2>
        {anchor ? (
          <>
            <p className="max-w-[62ch] text-[15px] leading-[1.6] text-paper-muted">
              Approved records are batched once a day into a single fingerprint, a Merkle root, and that root is written to a public blockchain. Only the root goes on chain: no photo, no location, no name.
            </p>
            <dl className="divide-y divide-paper-rule border-y border-paper-rule text-[15px]">
              {(
                [
                  ["Chain", `Base Sepolia (chain id ${anchor.chainId})`],
                  ["Batch", `${anchor.batchId} · ${ANCHOR_STATUS[anchor.status]}`],
                  ["Contract", <ExternalHash key="c" href={explorerAddress(anchor.contractAddress)} value={anchor.contractAddress} />],
                  ["Transaction", anchor.txHash ? <ExternalHash key="t" href={explorerTx(anchor.txHash)} value={anchor.txHash} /> : "Not recorded"],
                  ["Block", anchor.blockNumber ?? "Not confirmed yet"],
                  ["Merkle root", <span key="r" className="break-all font-mono text-[13px]">{anchor.merkleRoot}</span>],
                  ["Leaf", `number ${anchor.leafIndex + 1} in the batch, with a proof path of ${anchor.proof.length} ${anchor.proof.length === 1 ? "hash" : "hashes"}`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-4">
                  <dt className="text-paper-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="max-w-[62ch] text-[15px] leading-[1.6] text-paper-muted">
            None yet. Approved records are batched once a day into a single fingerprint that is written to a public blockchain. When this record is in a batch, this section shows the contract, the transaction and its proof path.
          </p>
        )}
      </section>

      {bundle && (
        <section aria-label="Keep a copy" className="print:hidden">
          <ComplianceExport bundle={bundle} theme="paper" />
        </section>
      )}

      {/* 8. What this does not prove: verbatim, docs/00-PRODUCT.md §3 */}
      <section aria-labelledby="limits" className="space-y-5 border-t border-paper-rule pt-10">
        <h2 id="limits" className="type-section">
          What this proves, and what it does not
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          {[
            ["It proves", PROVES],
            ["It does not prove", DOES_NOT_PROVE],
          ].map(([title, items]) => (
            <div key={title as string} className="space-y-3">
              <h3 className="text-[16px] font-medium">{title}</h3>
              <ul className="list-disc space-y-2 pl-5 text-[15px] leading-[1.55]">
                {(items as readonly string[]).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[14px] text-paper-muted">The chain comparison applies once a record is in a confirmed batch. Until then the fingerprints above are the check available.</p>
        <p className="text-[15px]">
          <Link href={`/p/${project.id}`} className="underline decoration-paper-rule underline-offset-[5px] hover:decoration-paper-ink">
            See the project
          </Link>
        </p>
      </section>
    </main>
  );
}

const ANCHOR_STATUS = { PENDING: "waiting to be sent", SUBMITTED: "sent, not confirmed yet", CONFIRMED: "confirmed", FAILED: "not confirmed, will be sent again" } as const;

function ExternalHash({ href, value }: { href: string; value: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all font-mono text-[13px] underline decoration-paper-rule underline-offset-4 hover:decoration-paper-ink">
      {value}
    </a>
  );
}

function Location({ project }: { project: PublicProof["project"] }) {
  return (
    <section aria-labelledby="location" className="space-y-5">
      <h2 id="location" className="type-section">
        Where
      </h2>
      <p className="max-w-[62ch] text-[15px] leading-[1.6] text-paper-muted">
        The exact boundary is not published, to protect the site. The point below is the centre of a grid cell near it. The commitment fixes the exact boundary without revealing it: anyone later shown the boundary and its salt can recompute it.
      </p>
      <dl className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
        <dt className="text-[15px] text-paper-muted">Approximate point</dt>
        <dd className="font-mono text-[14px] tabular-nums">{project.fuzzedLocation ? formatLatLon(project.fuzzedLocation.coordinates) : "Not published"}</dd>
        <dt className="text-[15px] text-paper-muted">Location commitment</dt>
        <dd>{project.locationCommitment ? <HashDisplay hash={project.locationCommitment} variant="full" theme="paper" label="Commitment" /> : "None"}</dd>
      </dl>
    </section>
  );
}
