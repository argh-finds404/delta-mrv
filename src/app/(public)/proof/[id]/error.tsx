"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";

export default function ProofDossierError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Proof dossier failure:", error);
  }, [error]);

  return (
    <div
      data-theme="paper"
      className="min-h-screen bg-paper text-paper-ink font-sans flex flex-col justify-between"
    >
      <header className="border-b border-paper-rule bg-paper-card px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/atlas" className="flex items-center gap-2 group">
            <Wordmark className="text-paper-ink" />
            <span className="text-paper-muted text-xs">/</span>
            <span className="text-xs text-paper-muted">Proof Dossier</span>
          </Link>
          <Link
            href="/atlas"
            className="text-xs text-paper-muted hover:text-paper-ink transition-colors"
          >
            ← Back to impact atlas
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-20 text-center space-y-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-paper-rule bg-paper-card text-paper-ink">
          <AlertCircle className="size-6 text-fraud" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-paper-ink">
            Could not load proof record
          </h1>
          <p className="text-sm text-paper-muted leading-relaxed">
            The cryptographic record could not be retrieved from the database. This is a temporary
            service failure, not a missing record.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-paper-muted">
              Error reference: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-paper-seal px-4 text-xs font-medium text-paper-card hover:bg-paper-seal/90 transition-colors"
          >
            <RotateCcw className="size-3.5" />
            <span>Try again</span>
          </button>
          <Link
            href="/atlas"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-paper-rule bg-paper-card px-4 text-xs font-medium text-paper-ink hover:bg-paper transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Return to atlas</span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-paper-rule py-4 text-center text-xs text-paper-muted">
        Delta MRV · Zero-Trust Ecological Verification
      </footer>
    </div>
  );
}

