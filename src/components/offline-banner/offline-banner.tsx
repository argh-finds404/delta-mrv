import * as React from "react";
import { WifiOff, RefreshCw, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface OfflineBannerProps {
  /** Whether the client browser currently lacks connectivity */
  isOffline: boolean;
  /** Number of pending submissions stored in IndexedDB offline queue */
  queuedCount?: number;
  /** Whether queue synchronization is currently active after reconnecting */
  isSyncing?: boolean;
  /** Callback to inspect the offline submission drawer */
  onViewQueue?: () => void;
  /** Theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * OfflineBanner — Persistent field connectivity status bar.
 * Authority: docs/15-UI-STATES.md §5.
 * Rule: Offline is a supported operational mode, not an error.
 * Persistent below the header — never a transient toast.
 */
export function OfflineBanner({
  isOffline,
  queuedCount = 0,
  isSyncing = false,
  onViewQueue,
  theme = "field",
  className,
}: OfflineBannerProps) {
  const isPaper = theme === "paper";

  // If online and not syncing and no queue, banner can be quiet or hidden
  if (!isOffline && !isSyncing && queuedCount === 0) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        "w-full border-b px-4 py-2 text-xs transition-colors",
        isOffline
          ? isPaper
            ? "border-[#8F5B10]/30 bg-[#E8A33D]/15 text-paper-ink"
            : "border-[#E8A33D]/30 bg-[#E8A33D]/10 text-field-text"
          : isSyncing
          ? isPaper
            ? "border-paper-seal/30 bg-[#1F6B55]/10 text-paper-ink"
            : "border-verified/30 bg-[#3E9D80]/10 text-field-text"
          : isPaper
          ? "border-paper-rule bg-paper-card text-paper-muted"
          : "border-field-hairline bg-field-canopy text-field-muted",
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Left Indicator */}
        <div className="flex items-center gap-2">
          {isOffline ? (
            <span className="flex items-center gap-1.5 font-medium text-review">
              <span className="inline-block size-2 rounded-full border border-review" />
              <WifiOff className="size-3.5" />
              <span>Offline mode</span>
            </span>
          ) : isSyncing ? (
            <span className="flex items-center gap-1.5 font-medium text-verified">
              <span className="inline-block size-2 rounded-full bg-verified" />
              <RefreshCw className="size-3.5 animate-spin" />
              <span>Back online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-verified">
              <CheckCircle2 className="size-3.5" />
              <span>Online</span>
            </span>
          )}

          <span
            className={cn(
              "hidden sm:inline",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            —
          </span>

          <span className="font-mono tabular-nums text-xs">
            {isOffline
              ? queuedCount > 0
                ? `${queuedCount} submission${queuedCount === 1 ? "" : "s"} queued in local storage`
                : "Capturing and hashing locally (IndexedDB)"
              : isSyncing
              ? `Syncing ${queuedCount} queued submission${queuedCount === 1 ? "" : "s"}…`
              : "All local captures synchronized"}
          </span>
        </div>

        {/* Right CTA */}
        {queuedCount > 0 && onViewQueue && (
          <button
            type="button"
            onClick={onViewQueue}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal",
              isPaper
                ? "bg-paper text-paper-ink hover:bg-paper-card"
                : "bg-field-raised text-field-text hover:bg-field-hairline"
            )}
          >
            <span>View queue</span>
            <ChevronRight className="size-3" />
          </button>
        )}
      </div>
    </aside>
  );
}

