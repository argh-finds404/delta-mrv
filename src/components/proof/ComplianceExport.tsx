"use client";

import * as React from "react";
import { Download, FileJson, Printer, ShieldCheck } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface ComplianceExportProps {
  submissionId: string;
  projectTitle: string;
  bundleData: Record<string, unknown>;
  theme?: "paper" | "field";
  className?: string;
}

export function ComplianceExport({
  submissionId,
  projectTitle,
  bundleData,
  theme = "paper",
  className,
}: ComplianceExportProps) {
  const isPaper = theme === "paper";
  const [downloaded, setDownloaded] = React.useState(false);

  const handleDownload = () => {
    const formatted = JSON.stringify(bundleData, null, 2);
    const blob = new Blob([formatted], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delta_verification_bundle_${submissionId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-6 space-y-4",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className,
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium flex items-center gap-2">
            <FileJson className={isPaper ? "size-4 text-paper-seal" : "size-4 text-signal"} />
            <span>Institutional Funder Compliance Export</span>
          </h3>
          <span
            className={cn(
              "font-mono text-[11px] px-2 py-0.5 rounded border",
              isPaper
                ? "border-paper-rule text-paper-muted bg-paper"
                : "border-field-hairline text-field-muted bg-field-raised",
            )}
          >
            Standalone Audit Package
          </span>
        </div>
        <p
          className={cn(
            "text-xs leading-relaxed max-w-2xl",
            isPaper ? "text-paper-muted" : "text-field-muted",
          )}
        >
          Export the complete cryptographic proof bundle for <strong className="text-current font-medium">{projectTitle}</strong> for independent offline verification, grant
          disbursement records, or institutional carbon registry audits.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 print:hidden">
        <button
          type="button"
          onClick={handleDownload}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-medium transition-colors shadow-xs",
            isPaper
              ? "bg-paper-seal text-paper-card hover:bg-paper-seal/90"
              : "bg-signal text-field-abyss hover:bg-[#B9EA5F]",
          )}
        >
          <Download className="size-3.5" />
          <span>{downloaded ? "Bundle Exported!" : "Download Verification Bundle (.json)"}</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border px-4 text-xs font-medium transition-colors",
            isPaper
              ? "border-paper-rule bg-paper text-paper-ink hover:bg-[#EBE4D5]"
              : "border-field-hairline bg-field-raised text-field-text hover:bg-field-canopy",
          )}
        >
          <Printer className="size-3.5" />
          <span>Print Dossier Certificate</span>
        </button>
      </div>

      <div
        className={cn(
          "text-[11px] leading-relaxed pt-2 border-t font-mono",
          isPaper ? "border-paper-rule text-paper-muted" : "border-field-hairline text-field-muted",
        )}
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-paper-seal shrink-0" />
          <span>
            Self-contained verification bundle contains: Canonical RFC 8785 manifest, raw SHA-256
            image hashes, Base Sepolia Merkle proof path, and reviewer quorum signatures.
          </span>
        </span>
      </div>
    </div>
  );
}
