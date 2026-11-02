import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  theme?: "field" | "paper";
}

/**
 * Base static skeleton element.
 * Obeying docs/15-UI-STATES.md §3: Surface --field-raised, NO shimmer animation.
 */
export function SkeletonBlock({
  className,
  theme = "field",
}: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div
      className={cn(
        "rounded-xs transition-opacity duration-120",
        isPaper ? "bg-[#EFE9DC]" : "bg-field-raised",
        className
      )}
    />
  );
}

/**
 * /lab queue skeleton: 8 rows (title bar, meta line, three severity pills)
 */
export function LabQueueSkeleton({ className, theme = "field" }: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-4",
        isPaper
          ? "border-paper-rule bg-paper-card"
          : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      <div className="flex items-center justify-between border-b pb-2 border-inherit">
        <SkeletonBlock theme={theme} className="h-4 w-32" />
        <SkeletonBlock theme={theme} className="h-4 w-20" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded border p-2.5 space-y-2",
              isPaper ? "border-paper-rule/60" : "border-field-hairline/60"
            )}
          >
            <div className="flex items-center justify-between">
              <SkeletonBlock theme={theme} className="h-3.5 w-48" />
              <div className="flex items-center gap-1.5">
                <SkeletonBlock theme={theme} className="h-4 w-12 rounded-sm" />
                <SkeletonBlock theme={theme} className="h-4 w-12 rounded-sm" />
                <SkeletonBlock theme={theme} className="h-4 w-12 rounded-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBlock theme={theme} className="h-3 w-28" />
              <SkeletonBlock theme={theme} className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Evidence pane skeleton: Two 4:3 blocks side by side, caption bars beneath
 */
export function EvidencePaneSkeleton({ className, theme = "field" }: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-4",
        isPaper
          ? "border-paper-rule bg-paper-card"
          : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before photograph placeholder */}
        <div className="space-y-2">
          <SkeletonBlock theme={theme} className="aspect-4/3 w-full rounded" />
          <div className="flex items-center justify-between px-1">
            <SkeletonBlock theme={theme} className="h-3.5 w-24" />
            <SkeletonBlock theme={theme} className="h-3 w-32" />
          </div>
        </div>
        {/* After photograph placeholder */}
        <div className="space-y-2">
          <SkeletonBlock theme={theme} className="aspect-4/3 w-full rounded" />
          <div className="flex items-center justify-between px-1">
            <SkeletonBlock theme={theme} className="h-3.5 w-24" />
            <SkeletonBlock theme={theme} className="h-3 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Findings pane skeleton: 3 cards (severity stripe, headline bar, two meta lines)
 */
export function FindingsPaneSkeleton({ className, theme = "field" }: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        isPaper
          ? "border-paper-rule bg-paper-card"
          : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      <SkeletonBlock theme={theme} className="h-4 w-36 mb-2" />

      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "relative rounded border p-3 pl-4 space-y-2 overflow-hidden",
            isPaper ? "border-paper-rule" : "border-field-hairline"
          )}
        >
          {/* Severity stripe on left */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1",
              isPaper ? "bg-[#DED6C6]" : "bg-field-raised"
            )}
          />
          <div className="flex items-center justify-between">
            <SkeletonBlock theme={theme} className="h-3.5 w-44" />
            <SkeletonBlock theme={theme} className="h-4 w-14 rounded-sm" />
          </div>
          <SkeletonBlock theme={theme} className="h-3 w-full max-w-[90%]" />
          <SkeletonBlock theme={theme} className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/**
 * /atlas skeleton: Map chrome and filter pills immediately rendered, canvas placeholder
 * Spec note: "Never skeleton a map — the container is the right shape already"
 */
export function AtlasSkeleton({ className, theme = "field" }: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div
      className={cn(
        "relative w-full h-80 rounded-lg border overflow-hidden flex flex-col justify-between p-4",
        isPaper
          ? "border-paper-rule bg-paper-card"
          : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      {/* Top Filter Pills Chrome */}
      <div className="flex items-center gap-2">
        <SkeletonBlock theme={theme} className="h-7 w-24 rounded-full" />
        <SkeletonBlock theme={theme} className="h-7 w-28 rounded-full" />
        <SkeletonBlock theme={theme} className="h-7 w-20 rounded-full" />
      </div>

      {/* Map loading center notice */}
      <div className="self-center font-mono text-xs text-field-muted flex items-center gap-2">
        <span>Initializing cartographic canvas…</span>
      </div>

      {/* Bottom Telemetry Bar Chrome */}
      <div className="flex items-center justify-between">
        <SkeletonBlock theme={theme} className="h-6 w-36" />
        <SkeletonBlock theme={theme} className="h-6 w-28" />
      </div>
    </div>
  );
}

/**
 * /proof/[id] skeleton: Header text, then a verification-badge placeholder
 */
export function ProofDossierSkeleton({ className, theme = "paper" }: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div
      className={cn(
        "rounded-lg border p-6 space-y-6",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      <div className="space-y-2 border-b pb-4 border-inherit">
        <SkeletonBlock theme={theme} className="h-7 w-72" />
        <SkeletonBlock theme={theme} className="h-4 w-96 max-w-full" />
      </div>

      <div className="flex items-center gap-4">
        <SkeletonBlock theme={theme} className="h-8 w-36 rounded-sm" />
        <SkeletonBlock theme={theme} className="h-4 w-48" />
      </div>

      <div className="space-y-3 pt-2">
        <SkeletonBlock theme={theme} className="h-4 w-40" />
        <SkeletonBlock theme={theme} className="h-10 w-full" />
        <SkeletonBlock theme={theme} className="h-10 w-full" />
      </div>
    </div>
  );
}

/**
 * /dashboard skeleton: Tile grid at final dimensions, numbers as bars
 */
export function DashboardSkeleton({ className, theme = "field" }: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg border p-4 space-y-3",
            isPaper
              ? "border-paper-rule bg-paper-card"
              : "border-field-hairline bg-field-canopy"
          )}
        >
          <div className="flex items-center justify-between">
            <SkeletonBlock theme={theme} className="h-3.5 w-24" />
            <SkeletonBlock theme={theme} className="size-4 rounded-xs" />
          </div>
          <SkeletonBlock theme={theme} className="h-8 w-16" />
          <SkeletonBlock theme={theme} className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

/**
 * Hash values skeleton: Exactly 64 monospace characters wide in --field-raised
 * Preserves zero layout shift when cryptographic digest loads.
 */
export function HashSkeleton({ className, theme = "field" }: SkeletonProps) {
  const isPaper = theme === "paper";
  return (
    <div
      className={cn(
        "inline-flex items-center rounded border px-2 py-1",
        isPaper
          ? "border-paper-rule bg-paper-card"
          : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      <SkeletonBlock
        theme={theme}
        className="h-3.5 w-[512px] max-w-full rounded-[2px]"
      />
    </div>
  );
}

export const SkeletonSet = {
  Block: SkeletonBlock,
  LabQueue: LabQueueSkeleton,
  EvidencePane: EvidencePaneSkeleton,
  FindingsPane: FindingsPaneSkeleton,
  Atlas: AtlasSkeleton,
  ProofDossier: ProofDossierSkeleton,
  Dashboard: DashboardSkeleton,
  Hash: HashSkeleton,
};

