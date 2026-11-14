import { ExternalLink } from "lucide-react";
import { explorerTx } from "@/src/lib/chain/registry";
import { cn } from "@/src/lib/utils";

type Stage = { label: string; detail: string; state: "done" | "waiting" };

export interface CustodyTimelineProps {
  files: { role: string; round: number }[];
  decisions: { decision: "APPROVE" | "REJECT" | "REQUEST_MORE_PROOF"; round: number; reviewerOrgName: string }[];
  anchor: { status: "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED"; txHash: string | null; blockNumber: number | null; batchId: number } | null;
  /** How the capture was signed, when it was (X2). */
  capture?: string;
}

/**
 * The four steps an approved record went through, as stored (docs/05-ROUTES.md §4). A summary
 * for a reader in a hurry: the check that matters is the one the page runs in the browser below.
 */
export function CustodyTimeline({ files, decisions, anchor, capture }: CustodyTimelineProps) {
  const round = Math.max(1, ...decisions.map((d) => d.round));
  const approvals = decisions.filter((d) => d.round === round && d.decision === "APPROVE");
  const orgs = [...new Set(approvals.map((d) => d.reviewerOrgName))];
  const stages: Stage[] = [
    {
      label: "Captured and fingerprinted",
      detail: `${files.length} ${files.length === 1 ? "file" : "files"}, each fingerprinted by the server from the stored bytes${capture ? `. ${capture}` : ""}`,
      state: files.length ? "done" : "waiting",
    },
    { label: "Automatic checks", detail: "Reuse, near-duplicates, capture time and position, before review", state: "done" },
    {
      label: "Independent review",
      detail: approvals.length ? `${approvals.length} ${approvals.length === 1 ? "approval" : "approvals"} from ${orgs.join(" and ")}${round > 1 ? `, in round ${round}` : ""}` : "Approved",
      state: "done",
    },
    {
      label: "Anchored on Base Sepolia",
      detail:
        anchor?.status === "CONFIRMED"
          ? `Batch ${anchor.batchId}${anchor.blockNumber ? `, block ${anchor.blockNumber.toLocaleString("en-GB")}` : ""}`
          : anchor
            ? `In batch ${anchor.batchId}, not confirmed yet`
            : "Waiting for the next daily batch",
      state: anchor?.status === "CONFIRMED" ? "done" : "waiting",
    },
  ];

  return (
    <section aria-labelledby="custody" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="custody" className="text-[16px] font-medium">
          How this record got here
        </h2>
        {anchor?.txHash && (
          <a
            href={explorerTx(anchor.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-paper-rule bg-paper-card px-3.5 text-[14px] font-medium transition-colors hover:border-paper-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink"
          >
            View the transaction on BaseScan
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </div>
      <ol className="grid gap-0 md:grid-cols-4" data-testid="custody-timeline">
        {stages.map((s, i) => (
          <li key={s.label} data-state={s.state} className="relative flex gap-3 pb-5 md:block md:pb-0 md:pr-4">
            {/* the line to the next step: down on a phone, across on a wide screen */}
            {i < stages.length - 1 && (
              <span aria-hidden className={cn("absolute left-[7px] top-5 h-[calc(100%-12px)] w-px md:left-5 md:top-[7px] md:h-px md:w-[calc(100%-12px)]", stages[i + 1]!.state === "done" ? "bg-paper-seal" : "bg-paper-rule")} />
            )}
            <span aria-hidden className={cn("relative z-10 mt-1 block size-[15px] shrink-0 rounded-full border-2", s.state === "done" ? "border-paper-seal bg-paper-seal" : "border-paper-muted bg-paper")} />
            <span className="block md:mt-3">
              <span className="block text-[15px] font-medium">
                {s.label}
                <span className="sr-only">{s.state === "done" ? ", done" : ", not yet"}</span>
              </span>
              <span className="mt-0.5 block text-[13px] leading-[1.5] text-paper-muted">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[13px] text-paper-muted">As recorded. The check below recomputes the record in your browser and asks the chain itself.</p>
    </section>
  );
}
