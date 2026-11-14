"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error for client telemetry / observability
    console.error("Project page failure:", error);
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
            <span className="text-xs text-paper-muted">Projects</span>
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
            Could not load project record
          </h1>
          <p className="text-sm text-paper-muted leading-relaxed">
            The database connection or public read service encountered an error. The project record was not changed.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-paper-ink/20 bg-paper-ink px-4 text-xs font-medium text-paper transition-colors hover:bg-paper-ink/90 focus-visible:outline-2 focus-visible:outline-paper-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            <span>Try again</span>
          </button>
          <Link
            href="/atlas"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-paper-rule bg-paper-card px-4 text-xs font-medium text-paper-ink transition-colors hover:border-paper-muted focus-visible:outline-2 focus-visible:outline-paper-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            <span>Return to Atlas</span>
          </Link>
        </div>

        {error.digest && (
          <p className="text-[11px] font-mono text-paper-muted pt-4">
            Reference code: {error.digest}
          </p>
        )}
      </main>

      <footer className="border-t border-paper-rule py-6 text-center text-xs text-paper-muted">
        Delta MRV · Independent verification for restoration claims
      </footer>
    </div>
  );
}

