"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";

export default function WorkspaceProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Workspace project page failure:", error);
  }, [error]);

  return (
    <div data-theme="field" className="min-h-screen bg-field-abyss text-field-text font-sans flex flex-col justify-between">
      <header className="border-b border-field-hairline bg-field-canopy px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Wordmark className="text-field-text" />
            <span className="text-field-hairline">/</span>
            <span className="text-xs text-field-muted font-mono uppercase">Projects</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs text-field-muted hover:text-field-text transition-colors flex items-center gap-1 font-mono"
          >
            <ArrowLeft className="size-3" />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 py-20 text-center space-y-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-fraud/40 bg-fraud/10 text-fraud">
          <AlertCircle className="size-6" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-field-text">
            Could not load project workspace
          </h1>
          <p className="text-xs text-field-muted leading-relaxed">
            The project details could not be loaded from the database. Please verify your network connection
            and try again.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-field-muted">
              Reference: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-4 text-xs font-medium text-field-abyss hover:bg-[#186747] transition-colors"
          >
            <RotateCcw className="size-3.5" />
            <span>Retry</span>
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-field-hairline bg-field-raised px-4 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors font-mono"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-field-hairline py-4 text-center text-xs text-field-muted font-mono">
        Delta MRV · Workspace
      </footer>
    </div>
  );
}

