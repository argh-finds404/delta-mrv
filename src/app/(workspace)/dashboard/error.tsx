"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Compass, RotateCcw } from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div
      data-theme="field"
      className="min-h-screen bg-field-abyss text-field-text font-sans flex flex-col justify-between"
    >
      <header className="border-b border-field-hairline bg-field-canopy px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Delta Home">
              <Wordmark className="text-field-text" />
            </Link>
            <span className="text-field-hairline">/</span>
            <span className="text-xs font-mono uppercase tracking-wider text-field-muted">
              Dashboard
            </span>
          </div>
          <Link
            href="/atlas"
            className="inline-flex items-center gap-1.5 text-xs text-field-muted hover:text-field-text transition-colors"
          >
            <Compass className="size-3.5" />
            <span>Impact Atlas</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-20 text-center space-y-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-field-hairline bg-field-canopy text-review">
          <AlertTriangle className="size-6" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-field-text">
            Workspace data unavailable
          </h1>
          <p className="text-xs text-field-muted leading-relaxed">
            Your session is valid, but the database connection was interrupted or timed out. No data was modified.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-4 text-xs font-medium text-field-abyss transition-colors hover:bg-[#186747] focus-visible:outline-2 focus-visible:outline-signal"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            <span>Retry</span>
          </button>
          <Link
            href="/atlas"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-field-hairline bg-field-raised px-4 text-xs font-medium text-field-text transition-colors hover:bg-field-canopy focus-visible:outline-2 focus-visible:outline-signal"
          >
            <Compass className="size-3.5" aria-hidden />
            <span>Go to Atlas</span>
          </Link>
        </div>

        {error.digest && (
          <p className="text-[11px] font-mono text-field-muted pt-4">
            Error digest: {error.digest}
          </p>
        )}
      </main>

      <footer className="border-t border-field-hairline py-6 text-center text-xs text-field-muted">
        Delta MRV · Workspace Telemetry
      </footer>
    </div>
  );
}

