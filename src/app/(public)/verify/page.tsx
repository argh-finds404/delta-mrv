import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";
import { ReverseLookup } from "@/src/components/verify/ReverseLookup";

export const metadata: Metadata = {
  title: "Reverse Proof Lookup · Delta",
  description:
    "Verify any ecological grant evidence photograph, transaction hash, or proof identifier against Delta's immutable ledger.",
};

export default function VerifyPage() {
  return (
    <div
      data-theme="paper"
      className="min-h-screen bg-paper text-paper-ink font-sans transition-colors pb-16"
    >
      {/* Paper Top Navigation */}
      <nav className="border-b border-paper-rule bg-paper-card px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/atlas" className="flex items-center gap-2 group">
            <Wordmark className="text-paper-ink" />
            <span className="text-paper-muted text-xs">/</span>
            <span className="text-xs text-paper-muted">Reverse Verification</span>
          </Link>

          <Link
            href="/atlas"
            className="text-xs text-paper-muted hover:text-paper-ink transition-colors flex items-center gap-1 font-mono"
          >
            <ArrowLeft className="size-3" />
            <span>Impact Atlas</span>
          </Link>
        </div>
      </nav>

      {/* Main Single-Column Paper Measure */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <header className="space-y-3 text-center max-w-xl mx-auto">
          <span className="rounded-md border border-paper-rule bg-paper-card px-2.5 py-1 text-xs font-mono text-paper-muted uppercase tracking-wider">
            Public Audit Lookup (Amendment A7)
          </span>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-paper-ink sm:text-4xl">
            Verify Ecological Evidence
          </h1>
          <p className="text-sm text-paper-muted leading-relaxed">
            Validate any grant evidence photograph, transaction hash, or proof identifier against
            Delta’s cryptographic ledger. No account or web3 wallet required.
          </p>
        </header>

        <ReverseLookup theme="paper" />

        <footer className="border-t border-paper-rule pt-8 text-xs text-paper-muted space-y-2 max-w-2xl mx-auto text-center">
          <p className="leading-relaxed">
            Delta proves that specific photographic files existed at specific times, that
            independent verifiers reviewed them under a conflict-of-interest protocol, and that the
            record has not been altered since anchoring.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2 text-[11px] font-mono">
            <Link href="/trust" className="hover:text-paper-ink hover:underline">
              Trust &amp; Transparency Statement
            </Link>
            <span>·</span>
            <Link href="/atlas" className="hover:text-paper-ink hover:underline">
              Impact Atlas
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

