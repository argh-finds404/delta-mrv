"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileJson, Printer, ShieldCheck } from "lucide-react";
import { BUNDLE_EXTENSION, type ProofBundle } from "@/src/lib/proof-bundle";
import { cn } from "@/src/lib/utils";

export interface ComplianceExportProps {
  /** The offline proof file (delta.proof-bundle.v1), built on the server from the stored record. */
  bundle: ProofBundle;
  theme?: "paper" | "field";
  className?: string;
}

/**
 * "Keep a copy": the record as one file an auditor archives for a decade and rechecks at /verify,
 * or with any SHA-256, Merkle and RPC tooling, with no Delta server and no database.
 */
export function ComplianceExport({ bundle, theme = "paper", className }: ComplianceExportProps) {
  const isPaper = theme === "paper";
  const [downloaded, setDownloaded] = React.useState(false);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify({ ...bundle, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delta-proof-${bundle.record.submissionId.slice(0, 8)}${BUNDLE_EXTENSION}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className={cn("space-y-4 rounded-xl border p-6", isPaper ? "border-paper-rule bg-paper-card text-paper-ink" : "border-field-hairline bg-field-canopy text-field-text", className)}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-medium">
            <FileJson className={isPaper ? "size-4 text-paper-seal" : "size-4 text-signal"} aria-hidden />
            <span>Keep a copy</span>
          </h3>
          <span className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", isPaper ? "border-paper-rule bg-paper text-paper-muted" : "border-field-hairline bg-field-raised text-field-muted")}>Works offline</span>
        </div>
        <p className={cn("max-w-2xl text-[14px] leading-relaxed", isPaper ? "text-paper-muted" : "text-field-muted")}>
          One file for <strong className="font-medium text-current">{bundle.record.projectTitle}</strong> that anyone can recheck years from now, without Delta: drop it on{" "}
          <Link href="/verify" className="text-current underline decoration-paper-rule underline-offset-4 hover:decoration-paper-ink">
            the check page
          </Link>
          , or redo the arithmetic with any SHA-256 and Merkle tool.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 print:hidden">
        <button
          type="button"
          onClick={handleDownload}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-medium shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-9",
            isPaper ? "bg-paper-seal text-paper-card hover:bg-paper-seal/90 focus-visible:outline-paper-ink" : "bg-signal text-field-abyss hover:bg-[#14543D] focus-visible:outline-signal",
          )}
        >
          <Download className="size-4" aria-hidden />
          <span aria-live="polite">{downloaded ? "Downloaded" : `Download the proof file (${BUNDLE_EXTENSION})`}</span>
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-9",
            isPaper ? "border-paper-rule bg-paper text-paper-ink hover:bg-[#EBE4D5] focus-visible:outline-paper-ink" : "border-field-hairline bg-field-raised text-field-text hover:bg-field-canopy focus-visible:outline-signal",
          )}
        >
          <Printer className="size-4" aria-hidden />
          <span>Print this page</span>
        </button>
      </div>

      <p className={cn("flex items-start gap-1.5 border-t pt-3 font-mono text-[11px] leading-relaxed", isPaper ? "border-paper-rule text-paper-muted" : "border-field-hairline text-field-muted")}>
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-paper-seal" aria-hidden />
        <span>
          It holds the sealed record exactly as anchored (RFC 8785 JSON), its fingerprint, the Merkle path to the batch root, the contract and transaction, the device signature if there is one,
          and every review decision. No photo and no exact location.
        </span>
      </p>
    </div>
  );
}
