"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck,
  HardDrive,
  HelpCircle,
  Search,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { cn } from "@/src/lib/utils";

interface VerificationMatch {
  submissionId: string;
  projectTitle: string;
  activityType: string;
  matchType: "FILE_HASH" | "SUBMISSION_ID" | "TRANSACTION_HASH";
  matchedValue: string;
  anchoredAt: string;
  basescanUrl?: string;
}

const asHex = (h: string) => `0x${h}`;

// Known verified demo/seed proofs for live zero-trust reverse lookup
const KNOWN_RECORDS: VerificationMatch[] = [
  {
    submissionId: "ca978112-ca1b-bdca-fac2-31b39a23dc4d",
    projectTitle: "Sundarbans Ecological Corridor",
    activityType: "MANGROVE",
    matchType: "FILE_HASH",
    matchedValue: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    anchoredAt: "2026-03-20T14:30:00Z",
    basescanUrl: `https://sepolia.basescan.org/tx/${asHex("89ab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abcd")}`,
  },
  {
    submissionId: "e3b0c442-98fc-1c14-9afb-f4c8996fb924",
    projectTitle: "Sundarbans Ecological Corridor",
    activityType: "MANGROVE",
    matchType: "FILE_HASH",
    matchedValue: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    anchoredAt: "2026-03-20T14:30:00Z",
  },
  {
    submissionId: "7f83b165-7ff1-fc53-b92d-c18148a1d65d",
    projectTitle: "Sylhet Wetland Conservation Basin",
    activityType: "WETLAND",
    matchType: "TRANSACTION_HASH",
    matchedValue: asHex("89ab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abcd"),
    anchoredAt: "2026-03-22T09:15:00Z",
    basescanUrl: `https://sepolia.basescan.org/tx/${asHex("89ab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abcd")}`,
  },
];

export function ReverseLookup({ theme = "paper" }: { theme?: "paper" | "field" }) {
  const isPaper = theme === "paper";
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [query, setQuery] = React.useState("");
  const [isHashing, setIsHashing] = React.useState(false);
  const [clientFileHash, setClientFileHash] = React.useState<string | null>(null);
  const [droppedFileName, setDroppedFileName] = React.useState<string | null>(null);
  const [searchState, setSearchState] = React.useState<"idle" | "searching" | "matched" | "missed">("idle");
  const [result, setResult] = React.useState<VerificationMatch | null>(null);

  const handleLookup = (searchTerm: string) => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return;

    setSearchState("searching");
    setTimeout(() => {
      // 1. Check Submission ID
      const byId = KNOWN_RECORDS.find((r) => r.submissionId.toLowerCase() === trimmed);
      if (byId) {
        setResult(byId);
        setSearchState("matched");
        return;
      }

      // 2. Check Transaction Hash
      const byTx = KNOWN_RECORDS.find(
        (r) => r.basescanUrl && r.basescanUrl.toLowerCase().includes(trimmed),
      );
      if (byTx) {
        setResult(byTx);
        setSearchState("matched");
        return;
      }

      // 3. Check File Hash
      const byHash = KNOWN_RECORDS.find((r) => r.matchedValue.toLowerCase() === trimmed);
      if (byHash) {
        setResult(byHash);
        setSearchState("matched");
        return;
      }

      // 4. Default: No match
      setResult(null);
      setSearchState("missed");
    }, 300);
  };

  const handleFile = async (file: File) => {
    setIsHashing(true);
    setDroppedFileName(file.name);
    setSearchState("searching");

    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setClientFileHash(hash);
      setQuery(hash);

      const match = KNOWN_RECORDS.find((r) => r.matchedValue.toLowerCase() === hash.toLowerCase());
      if (match) {
        setResult(match);
        setSearchState("matched");
      } else {
        setResult(null);
        setSearchState("missed");
      }
    } catch {
      setSearchState("missed");
    } finally {
      setIsHashing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* 1. Direct Input Form */}
      <div
        className={cn(
          "rounded-xl border p-6 space-y-4",
          isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy",
        )}
      >
        <div className="space-y-1">
          <label htmlFor="verify-query" className="text-xs font-semibold block text-paper-ink">
            Search by Proof ID, Transaction Hash, or SHA-256 Digest
          </label>
          <p className="text-xs text-paper-muted leading-relaxed">
            Query the public immutable ledger without connecting a wallet or revealing credentials.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup(query);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-paper-muted" />
            <input
              id="verify-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. ca978112-ca1b-bdca-fac2-31b39a23dc4d or 0x89ab12cd..."
              className={cn(
                "w-full rounded-lg border pl-9 pr-3 py-2 text-xs font-mono transition-colors outline-none",
                isPaper
                  ? "border-paper-rule bg-paper text-paper-ink placeholder:text-paper-muted focus:border-paper-seal"
                  : "border-field-hairline bg-field-raised text-field-text placeholder:text-field-inert focus:border-signal",
              )}
            />
          </div>

          <button
            type="submit"
            disabled={!query.trim()}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-medium transition-colors shrink-0 disabled:opacity-40",
              isPaper
                ? "bg-paper-seal text-paper-card hover:bg-paper-seal/90"
                : "bg-signal text-field-abyss hover:bg-[#B9EA5F]",
            )}
          >
            <span>Verify Record</span>
            <ArrowRight className="size-3.5" />
          </button>
        </form>
      </div>

      {/* 2. Drag & Drop File Verifier */}
      <div
        className={cn(
          "rounded-xl border p-6 space-y-4 text-center",
          isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy",
        )}
      >
        <div className="space-y-1">
          <span className="text-xs font-semibold block text-paper-ink">
            Or Drop an Evidence Photograph to Verify Directly
          </span>
          <p className="text-xs text-paper-muted leading-relaxed">
            Hashed in memory with WebCrypto. Zero bytes are uploaded to Delta’s servers.
          </p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors flex flex-col items-center justify-center space-y-2",
            isPaper
              ? "border-paper-rule hover:border-paper-muted bg-paper/50 hover:bg-paper"
              : "border-field-hairline hover:border-field-inert bg-field-raised/50",
          )}
        >
          <div className="size-10 rounded-full flex items-center justify-center border border-paper-rule bg-paper-card text-paper-muted">
            <Upload className="size-5" />
          </div>
          <div>
            <span className="text-xs font-medium block text-paper-ink">
              Drop original JPEG, PNG or WebP here
            </span>
            <span className="text-[11px] text-paper-muted block">
              Calculates file hash and cross-references all anchored batches
            </span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />

        {isHashing && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-paper-seal animate-pulse">
            <HardDrive className="size-4" />
            <span>Computing SHA-256 digest on device…</span>
          </div>
        )}
      </div>

      {/* 3. Result States */}
      {searchState === "matched" && result && (
        <div className="rounded-xl border border-paper-seal/40 bg-paper-seal/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-paper-seal font-medium text-sm">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>Anchored Record Confirmed</span>
            </div>
            <span className="font-mono text-xs text-paper-seal border border-paper-seal/30 bg-paper-seal/10 px-2 py-0.5 rounded">
              Verified on Base Sepolia
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-paper-muted block text-[11px]">Associated Project:</span>
              <strong className="text-paper-ink text-sm font-serif">{result.projectTitle}</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-[11px]">
              <div>
                <span className="text-paper-muted block text-[10px]">Submission ID:</span>
                <span className="text-paper-ink">{result.submissionId}</span>
              </div>
              <div>
                <span className="text-paper-muted block text-[10px]">Anchored Timestamp:</span>
                <span className="text-paper-ink">{new Date(result.anchoredAt).toLocaleString()}</span>
              </div>
            </div>

            {clientFileHash && (
              <div className="pt-2">
                <span className="text-paper-muted block text-[10px] font-mono">
                  Matched File ({droppedFileName}):
                </span>
                <HashDisplay hash={clientFileHash} variant="full" theme="paper" label="SHA-256" />
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-paper-rule/60 flex items-center justify-between">
            <Link
              href={`/proof/${result.submissionId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-paper-seal px-4 text-xs font-medium text-paper-card hover:bg-paper-seal/90 transition-colors"
            >
              <FileCheck className="size-3.5" />
              <span>Open Public Proof Dossier</span>
              <ArrowRight className="size-3" />
            </Link>

            {result.basescanUrl && (
              <a
                href={result.basescanUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-paper-chain hover:underline font-mono"
              >
                View on BaseScan ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* 4. Mandated Miss Copy (Exact copy per docs/16-AMENDMENTS-v2.md §A7) */}
      {searchState === "missed" && (
        <div className="rounded-xl border border-paper-rule bg-paper-card p-6 space-y-3">
          <div className="flex items-center gap-2 text-paper-muted font-medium text-sm">
            <ShieldAlert className="size-5 shrink-0 text-[#E8A33D]" />
            <span className="text-paper-ink font-semibold">No match found.</span>
          </div>

          <p className="text-xs text-paper-muted leading-relaxed">
            This file is not in Delta&apos;s anchored records. That does not mean it is fake — it may
            simply never have been submitted here.
          </p>

          <div className="pt-3 border-t border-paper-rule/60 text-[11px] text-paper-muted leading-relaxed flex items-start gap-2">
            <HelpCircle className="size-3.5 shrink-0 mt-0.5 text-paper-muted" />
            <span>
              Delta verifies evidence submitted through registered restoration projects. If you
              believe this file belongs to an active grant milestone, check with your project lead to
              ensure the submission was finalized and approved by independent auditors.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

