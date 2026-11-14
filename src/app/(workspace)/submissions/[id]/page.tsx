import * as React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, Camera, ExternalLink, ShieldCheck } from "lucide-react";
import { AppShell, AppShellLoading } from "@/src/components/app/AppShell";
import { SitesMap } from "@/src/components/app/SitesMap";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { FindingCard } from "@/src/components/lab/FindingCard";
import { SEVERITY_ORDER, toLabFinding } from "@/src/components/lab/to-lab-finding";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { explorerTx } from "@/src/lib/chain/registry";
import { ACTIVITY_LABEL, formatCount, formatLatLon } from "@/src/lib/format";
import { isOperator } from "@/src/server/services/operators";
import type { SubmissionStatus } from "@/src/lib/status";
import { requireSession } from "@/src/server/auth/session";
import { NotFoundError } from "@/src/server/services/errors";
import { getProject, myOrganisations } from "@/src/server/services/projects.service";
import { getRoundDecisions, type RoundDecision } from "@/src/server/services/reviews.service";
import { getPublicProof, getSubmissionDetail, listFindings, type EvidenceFileView } from "@/src/server/services/submissions.service";
import { workspaceSites } from "../../sites";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Submission · Delta",
  description: "The full record of one submission: its photos, the checks, every decision and its reason.",
};

const QUORUM = 2; // docs/01-FEATURE-LOCK.md
const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;
const primary =
  "inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const secondary =
  "inline-flex h-11 items-center gap-2 rounded-xl border border-field-hairline bg-field-canopy px-4 text-[15px] font-medium transition-colors hover:bg-field-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const card = "rounded-2xl border border-field-hairline bg-field-canopy";
const h2 = "font-serif text-[28px] leading-tight tracking-[-0.01em]";

const when = (d: Date) => `${d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;

/** What the state means for the person reading, in a sentence. The reasons themselves come from the reviewers. */
const VERDICT: Record<SubmissionStatus, { title: string; owner: string; verifier?: string }> = {
  DRAFT: { title: "Not sent yet", owner: "This submission was started and its photos were never sent. A draft with no photos is removed after 24 hours." },
  PENDING_FORENSICS: {
    title: "Being checked",
    owner: "The automatic checks are running on the stored photos: fingerprints, duplicates, location and capture time. Reviewers see the record when they finish.",
  },
  IN_REVIEW: { title: "In review", owner: "Two reviewers from an independent organisation each decide, and each writes a reason. Nothing is decided until both have." },
  NEEDS_MORE_PROOF: {
    title: "More proof was asked for",
    owner: "A reviewer could not decide on what was sent, and said why below. Add one more photo and the record goes back to review as a new round.",
    verifier: "A reviewer could not decide on what was sent. The owner has been asked for one more photo; the record returns to review as a new round when it arrives.",
  },
  ESCALATED: {
    title: "The reviewers disagreed",
    owner: "One reviewer approved and one rejected. An administrator of the reviewing organisation, who has not voted in this round, casts the deciding vote.",
  },
  APPROVED: { title: "Approved", owner: "Two reviewers from an independent organisation approved this record. It is public now, and is anchored with the next daily batch." },
  ANCHORED: { title: "Approved and anchored", owner: "Two reviewers approved this record, and its fingerprint is written to Base Sepolia. Anyone can check it on the proof page." },
  REJECTED: {
    title: "Rejected",
    owner: "Two reviewers rejected this record, and that is final for this submission. Their reasons are below. New evidence is sent as a new submission.",
  },
};

const DECISION = {
  APPROVE: { label: "Approved", color: "#1A7A51" },
  REJECT: { label: "Rejected", color: "#C03D29" },
  REQUEST_MORE_PROOF: { label: "Asked for more proof", color: "#9C5D00" },
} as const;

// a stored event name never reaches the screen (docs/18-VISUAL-CORRECTION.md §2)
const EVENT_LABEL: Record<string, string> = {
  SUBMISSION_FINALIZED: "The photos were sent and stored",
  SUBMISSION_SUPPLEMENTED: "One more photo was sent",
  FORENSICS_COMPLETED: "The automatic checks finished",
  REVIEW_DECISION: "A reviewer recorded a decision",
  ANCHOR_CONFIRMED: "The chain confirmed the anchor",
};

const ROLE_LABEL = { BEFORE: "Before", AFTER: "After", SUPPLEMENT: "Supplementary photo" } as const;
const MIME_LABEL: Record<string, string> = { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP" };
const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(bytes < 104_858 ? 2 : 1)} MB`;

export default function SubmissionPage({ params }: Props) {
  return (
    <React.Suspense fallback={<AppShellLoading />}>
      <SubmissionBody params={params} />
    </React.Suspense>
  );
}

function Decisions({ decisions }: { decisions: RoundDecision[] }) {
  return (
    <ul className="space-y-3">
      {decisions.map((d, i) => (
        <li key={i} className={`${card} space-y-2 p-5`}>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px]">
            <span className="inline-flex items-center gap-2 text-[15px] font-medium" style={{ color: DECISION[d.decision].color }}>
              <span aria-hidden className="size-2 rounded-full bg-current" />
              {DECISION[d.decision].label}
            </span>
            <span className="text-field-muted">
              {d.mine ? "by you" : `by a reviewer at ${d.reviewerOrgName}`} · {when(d.createdAt)}
            </span>
          </p>
          <blockquote className="max-w-[70ch] whitespace-pre-line text-[17px] leading-[1.55]">{d.reason}</blockquote>
        </li>
      ))}
    </ul>
  );
}

function FileCard({ file }: { file: EvidenceFileView }) {
  const label = file.role === "SUPPLEMENT" ? `${ROLE_LABEL.SUPPLEMENT}, round ${file.round}` : ROLE_LABEL[file.role];
  const camera = [file.exif?.make, file.exif?.model].filter(Boolean).join(" ");
  const facts: [string, string][] = [
    ["Taken", file.capturedAt ? when(file.capturedAt) : "The file does not say"],
    ["Position", file.gps ? formatLatLon(file.gps.coordinates, 5) : "The file carries none"],
    ["Camera", camera || "The file does not say"],
    ["File", `${MIME_LABEL[file.mime] ?? file.mime}, ${megabytes(file.sizeBytes)}`],
    [
      "Fingerprint from the device",
      file.clientSha256 === null ? "None was sent" : file.clientSha256 === file.sha256 ? "Matches the stored file" : "Differs from the stored file: see the finding",
    ],
    ...(file.dhash ? ([["Perceptual hash", BigInt(`0b${file.dhash}`).toString(16).padStart(16, "0")]] as [string, string][]) : []),
  ];
  return (
    <figure className={`${card} overflow-hidden`}>
      <a href={`/api/evidence/${file.id}`} target="_blank" rel="noreferrer" className="block bg-field-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal">
        <Image src={`/api/evidence/${file.id}`} alt={`${label} photo. Opens the stored original.`} width={800} height={600} unoptimized className="aspect-[4/3] w-full object-contain" />
      </a>
      <figcaption className="space-y-3 p-5">
        <p className="text-[16px] font-medium">{label}</p>
        <HashDisplay hash={file.sha256} variant="full" theme="field" label="SHA-256" />
        <details className="group">
          <summary className="cursor-pointer list-none rounded-sm text-[14px] text-field-muted hover:text-field-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal [&::-webkit-details-marker]:hidden">
            What the file says about itself
          </summary>
          <dl className="space-y-1.5 pt-3 text-[14px]">
            {facts.map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <dt className="text-field-muted">{k}</dt>
                <dd className="text-right tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      </figcaption>
    </figure>
  );
}

async function SubmissionBody({ params }: Props) {
  await connection();
  const session = await requireSession();
  const { id } = await params;
  const actor = { userId: session.user.id };

  const detail = await getSubmissionDetail(actor, id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { submission: s, project, files, events, access, capture } = detail;
  const isPublic = s.status === "APPROVED" || s.status === "ANCHORED";
  const [{ findings }, round, orgs, fullProject, proof] = await Promise.all([
    listFindings(actor, id),
    getRoundDecisions(actor, id),
    myOrganisations(actor),
    getProject(actor, project.id),
    isPublic ? getPublicProof(id) : null,
  ]);
  const sites = await workspaceSites(session.user.id, [fullProject]);

  const isOwner = access === "owner";
  const open = s.status === "IN_REVIEW" || s.status === "ESCALATED";
  const verdict = VERDICT[s.status];
  const recorded = round.counts.approve + round.counts.reject + round.counts.moreProof;
  const sorted = findings.map((f) => toLabFinding({ ...f, evidence: (f.evidence ?? {}) as Record<string, unknown> }, files)).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const checksPending = s.status === "DRAFT" || s.status === "PENDING_FORENSICS";
  const anchor = proof?.anchor ?? null;

  return (
    <AppShell
      userName={session.user.name || session.user.email}
      context={orgs[0]?.orgName}
      review={orgs.some((o) => o.orgType === "VERIFIER") ? { count: 0 } : null}
      operator={await isOperator({ userId: session.user.id })}
    >
      <main className="mx-auto max-w-[1200px] space-y-12 px-4 py-8 sm:px-6 lg:py-12">
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 rounded-sm text-[14px] text-field-muted transition-colors hover:text-field-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
          <ArrowLeft className="size-4" aria-hidden />
          {project.title}
        </Link>

        <header className="rise-in flex flex-wrap items-end justify-between gap-6" style={rise(0)}>
          <div className="max-w-[760px] space-y-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-field-muted">
              <StatusBadge status={s.status} />
              <span>
                {ACTIVITY_LABEL[project.activityType]} · {project.ownerOrgName}
              </span>
            </p>
            <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">{verdict.title}</h1>
            <p className="text-[17px] leading-[1.55] text-field-muted">{(!isOwner && verdict.verifier) || verdict.owner}</p>
            <p className="text-[14px] text-field-muted">
              Submission <span className="font-mono">{s.id.slice(0, 8)}</span> · round {s.round} · started {when(s.submittedAt)}
            </p>
            {s.followsSubmissionId && (
              <p className="text-[15px]" data-testid="checkup-of">
                A survival check-up of{" "}
                <Link href={`/submissions/${s.followsSubmissionId}`} className="font-medium text-signal underline-offset-4 hover:underline">
                  record {s.followsSubmissionId.slice(0, 8)}
                </Link>
                : the same spot, photographed again after it was approved.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isPublic && (
              <Link href={`/proof/${s.id}`} className={secondary}>
                Public proof page
                <ExternalLink className="size-4" aria-hidden />
              </Link>
            )}
            {isOwner && isPublic && project.status === "ACTIVE" && (
              <Link href={`/projects/${project.id}/submit?checkup=${s.followsSubmissionId ?? s.id}`} className={secondary}>
                <Camera className="size-[18px]" aria-hidden />
                Start a check-up
              </Link>
            )}
            {isOwner && s.status === "NEEDS_MORE_PROOF" && (
              <Link href={`/projects/${project.id}/submit?supplement=${s.id}`} className={primary}>
                <Camera className="size-[18px]" aria-hidden />
                Add a photo
              </Link>
            )}
            {!isOwner && open && (
              <Link href={`/lab?s=${s.id}`} className={primary}>
                <ShieldCheck className="size-[18px]" aria-hidden />
                Open in review
              </Link>
            )}
          </div>
        </header>

        {/* The decisions come first: for a rejected record this page is the explanation (docs/14 §7) */}
        {s.status !== "DRAFT" && s.status !== "PENDING_FORENSICS" && (
          <section aria-labelledby="decisions" className="rise-in space-y-5" style={rise(1)}>
            <h2 id="decisions" className={h2}>
              Decisions and reasons
            </h2>
            {round.decisions === null ? (
              <p className={`${card} max-w-[760px] p-5 text-[15px] leading-[1.6]`} data-testid="round-hidden">
                {formatCount(recorded)} of {QUORUM} decisions recorded in round {round.round}.{" "}
                <span className="text-field-muted">
                  {isOwner
                    ? "Each decision and its reason is shown here once the round is decided, so no reviewer is steered by another's verdict."
                    : "The other decision and its reason are shown once you have recorded yours, so neither reviewer is steered by the other."}
                </span>
              </p>
            ) : round.decisions.length === 0 ? (
              <p className="text-[15px] text-field-muted">No decision has been recorded in round {round.round}.</p>
            ) : (
              <Decisions decisions={round.decisions} />
            )}
            {round.earlierRounds.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[16px] font-medium">Earlier rounds</h3>
                <Decisions decisions={round.earlierRounds} />
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="evidence" className="rise-in space-y-5" style={rise(2)}>
          <h2 id="evidence" className={h2}>
            Evidence
          </h2>
          {files.length === 0 ? (
            <p className="text-[15px] text-field-muted">No photo is stored for this submission.</p>
          ) : (
            <>
              <p className="max-w-[70ch] text-[15px] leading-[1.6] text-field-muted">
                The stored originals, each with the fingerprint the server computed from the stored bytes. A changed file has a different fingerprint.
              </p>
              <p className="max-w-[70ch] rounded-xl border border-field-hairline bg-field-canopy px-4 py-3 text-[15px] leading-[1.6]" data-testid="capture-badge" data-state={capture ? (capture.verified ? "valid" : "invalid") : "standard"}>
                {!capture ? (
                  <>
                    <span className="font-medium">Standard SHA-256 fingerprints.</span> <span className="text-field-muted">The photos were sent without a device signature.</span>
                  </>
                ) : capture.verified ? (
                  <>
                    <span className="font-medium text-verified">Device-signed capture.</span>{" "}
                    <span className="text-field-muted">
                      The sending browser signed exactly these fingerprints with its key <span className="font-mono">{capture.keyId}</span>, by its own clock at {when(new Date(capture.signedAt))}. The key
                      is held by a browser, not a hardware chip.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-fraud">A device signature was sent but did not verify.</span> <span className="text-field-muted">{capture.reason}.</span>
                  </>
                )}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {files.map((f) => (
                  <FileCard key={f.id} file={f} />
                ))}
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="findings" className="rise-in space-y-5" style={rise(3)}>
          <h2 id="findings" className={h2}>
            What the checks found
          </h2>
          {sorted.length > 0 ? (
            <div className="grid max-w-[900px] gap-2">
              {sorted.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          ) : (
            <p className="max-w-[70ch] text-[15px] leading-[1.6] text-field-muted">
              {checksPending ? "The checks have not finished, so there is nothing to show yet." : "No finding is stored for this submission. That is not the same as the checks having passed."}
            </p>
          )}
          <p className="max-w-[70ch] text-[14px] leading-[1.6] text-field-muted">A finding is a signal for the reviewers, not a verdict. Only the reviewers decide.</p>
        </section>

        {sites.length > 0 && (
          <section aria-labelledby="site" className="rise-in space-y-3" style={rise(4)}>
            <h2 id="site" className={h2}>
              The site
            </h2>
            <SitesMap sites={sites} focusId={project.id} className="lift h-[320px] sm:h-[400px]" />
            <p className="text-[14px] text-field-muted">
              The exact boundary, with {formatCount(project.toleranceMeters)} m of tolerance. A photo&apos;s recorded position is checked against it; the result is in the findings above.
            </p>
          </section>
        )}

        {isPublic && (
          <section aria-labelledby="anchor" className="rise-in space-y-3" style={rise(5)}>
            <h2 id="anchor" className={h2}>
              Anchor
            </h2>
            <div className={`${card} max-w-[760px] space-y-3 p-5 text-[15px] leading-[1.6]`}>
              {anchor?.status === "CONFIRMED" ? (
                <p>
                  Confirmed on Base Sepolia in batch {anchor.batchId}
                  {anchor.confirmedAt ? `, ${when(anchor.confirmedAt)}` : ""}.{" "}
                  {anchor.txHash && (
                    <a href={explorerTx(anchor.txHash)} target="_blank" rel="noreferrer" className="font-medium text-signal underline underline-offset-4">
                      See the transaction
                    </a>
                  )}
                </p>
              ) : anchor ? (
                <p>In batch {anchor.batchId}, which the chain has not confirmed yet.</p>
              ) : (
                <p>Not in a batch yet. Approved records are batched and anchored once a day.</p>
              )}
              <Link href={`/proof/${s.id}`} className="inline-flex items-center gap-1.5 rounded-sm font-medium text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                Check it yourself on the proof page
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </section>
        )}

        <section aria-labelledby="trail" className="rise-in space-y-4" style={rise(6)}>
          <h2 id="trail" className={h2}>
            Audit trail
          </h2>
          {events.length === 0 ? (
            <p className="text-[15px] text-field-muted">No event is recorded on the audit chain for this submission.</p>
          ) : (
            <>
              <p className="max-w-[70ch] text-[15px] leading-[1.6] text-field-muted">
                Every step is an event on {project.ownerOrgName}&apos;s chain, fingerprinted together with the event before it, so none can be changed or removed without the chain breaking.
              </p>
              <ol className={`${card} divide-y divide-field-hairline`}>
                {events.map((e) => (
                  <li key={e.seq} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-[14px]">
                    <span className="w-16 tabular-nums text-field-muted">No. {e.seq}</span>
                    <span className="min-w-[14rem] flex-1 text-[15px]">{EVENT_LABEL[e.eventType] ?? "An event was recorded"}</span>
                    <time className="tabular-nums text-field-muted" dateTime={e.createdAt.toISOString()}>
                      {when(e.createdAt)}
                    </time>
                    <HashDisplay hash={e.eventHash} variant="truncated" theme="field" />
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}
