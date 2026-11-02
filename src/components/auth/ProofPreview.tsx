import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Shield } from "lucide-react";
import { VerificationBadge, HashDisplay } from "@/src/components";
import { cn } from "@/lib/utils";

export interface AnchoredProofRecord {
  /** Unique submission/proof identifier */
  id: string;
  /** Project title */
  projectTitle: string;
  /** Sponsoring or managing organisation */
  organization: string;
  /** Cryptographic verification result against Merkle root */
  verificationState: "MATCH" | "MISMATCH" | "PENDING" | "UNAVAILABLE";
  /** Authoritative SHA-256 hash */
  sha256Hash: string;
  /** Count of distinct verifier approvals */
  approvalsCount: number;
  /** Total global verified records */
  totalVerifiedRecords: number;
  /** Target link to the public proof dossier */
  proofUrl?: string;
}

export interface ProofPreviewProps {
  /** Anchored proof record data */
  record: AnchoredProofRecord;
  /** Render mode: full desktop side-panel or collapsed mobile banner */
  mode?: "full" | "collapsed";
  /** Additional CSS class names */
  className?: string;
}

/**
 * ProofPreview — Left-panel artifact showcase for auth pages.
 * Authority: docs/15-UI-STATES.md §6.
 * Demonstrates the product working on the sign-in page without marketing fluff.
 * Pure presentation: takes data as prop, fetches nothing.
 */
export function ProofPreview({
  record,
  mode = "full",
  className,
}: ProofPreviewProps) {
  // Mobile collapsed single-line mode (docs/15-UI-STATES.md §6)
  if (mode === "collapsed") {
    return (
      <aside
        aria-label="Live verification record summary"
        className={cn(
          "w-full border-b border-field-hairline bg-field-canopy px-4 py-2 text-xs text-field-muted md:hidden",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <Shield className="size-3.5 text-signal shrink-0" />
            <span className="font-medium text-field-text truncate">
              {record.projectTitle}
            </span>
            <span className="text-field-inert">·</span>
            <span className="font-mono tabular-nums text-verified text-[11px] shrink-0">
              ✓ Match
            </span>
          </div>

          <Link
            href={record.proofUrl ?? `/proof/${record.id}`}
            className="flex items-center gap-1 font-mono text-[11px] text-field-muted hover:text-field-text shrink-0"
          >
            <span>Proof</span>
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </aside>
    );
  }

  // Desktop full 45% panel layout
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between p-8 lg:p-12 text-field-text select-none",
        className
      )}
    >
      {/* Top Brand & Eyebrow */}
      <div className="space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-xs bg-field-raised border border-field-hairline">
            <span className="font-serif font-bold text-signal text-sm">Δ</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-field-text">
            Delta
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-wider text-field-muted">
            A live record
          </span>
          <div className="h-px w-12 bg-field-hairline" />
        </div>

        {/* Anchored Record Card */}
        <div className="rounded-lg border border-field-hairline bg-field-abyss/60 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-medium text-field-text">
              {record.projectTitle}
            </h2>
            <p className="text-xs text-field-muted mt-0.5">
              {record.organization}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <VerificationBadge
              state={record.verificationState}
              detail="Base Sepolia anchored"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono text-field-muted uppercase">
              Authoritative digest
            </span>
            <div>
              <HashDisplay
                hash={record.sha256Hash}
                variant="truncated"
                label="sha256"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-field-muted pt-1 border-t border-field-hairline/60">
            <CheckCircle2 className="size-3.5 text-verified shrink-0" />
            <span className="font-mono tabular-nums text-field-text">
              {record.approvalsCount} independent approvals
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Proof Metric & Outbound Link */}
      <div className="pt-8 border-t border-field-hairline/60 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono tabular-nums text-xl font-medium text-field-text">
            {record.totalVerifiedRecords.toLocaleString()}
          </span>
          <span className="text-xs text-field-muted">
            records anchored on-chain
          </span>
        </div>

        <Link
          href={record.proofUrl ?? `/proof/${record.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-field-muted hover:text-field-text transition-colors group"
        >
          <span>Open this record</span>
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
}

