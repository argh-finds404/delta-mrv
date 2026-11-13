"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";

// Every workspace page without its own error screen (docs/05-ROUTES.md §7: no crash pages).
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Workspace page failure:", error);
  }, [error]);

  return (
    <div data-theme="field" className="flex min-h-dvh flex-col bg-field-abyss font-sans text-field-text">
      <header className="border-b border-field-hairline bg-field-canopy px-4 py-4 sm:px-6">
        <Link href="/dashboard" aria-label="Delta, overview" className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto max-w-lg flex-1 space-y-6 px-6 py-20 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-fraud/40 bg-fraud/10 text-fraud">
          <AlertCircle className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-[28px] leading-tight">This page could not be loaded</h1>
          <p className="text-[15px] leading-[1.6] text-field-muted">Something failed while reading it. Nothing was changed. Try again, or go back to the overview.</p>
          {error.digest && <p className="font-mono text-[13px] text-field-muted">Reference: {error.digest}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-field-hairline bg-field-canopy px-4 text-[15px] transition-colors hover:bg-field-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Overview
          </Link>
        </div>
      </main>
    </div>
  );
}
