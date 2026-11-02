"use client";

import * as React from "react";
import {
  Pin,
  Search,
} from "lucide-react";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { SeverityChip } from "@/src/components/severity-chip/severity-chip";
import { EmptyState } from "@/src/components/empty-state/empty-state";
import type { LabSubmission } from "./fixtures";
import { cn } from "@/src/lib/utils";

export interface QueuePaneProps {
  /** Submissions awaiting review */
  submissions: LabSubmission[];
  /** Currently selected submission id */
  selectedId?: string;
  /** Selection handler */
  onSelect: (submissionId: string) => void;
  /** Whether the active viewer is a Verifier Administrator (pins ESCALATED items) */
  isVerifierAdmin?: boolean;
  /** Empty state mode */
  emptyStateMode?: "none" | "no-assignments" | "queue-clear";
  /** Optional theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * Severity weight comparator for sorting:
 * HIGH findings first, then MEDIUM, then LOW, then newest submittedAt.
 */
function compareSeverity(a: LabSubmission, b: LabSubmission): number {
  if (b.findingCounts.high !== a.findingCounts.high) {
    return b.findingCounts.high - a.findingCounts.high;
  }
  if (b.findingCounts.medium !== a.findingCounts.medium) {
    return b.findingCounts.medium - a.findingCounts.medium;
  }
  if (b.findingCounts.low !== a.findingCounts.low) {
    return b.findingCounts.low - a.findingCounts.low;
  }
  return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
}

/**
 * Formats ISO date to compact monospace timestamp.
 */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const m = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate().toString().padStart(2, "0");
    const h = d.getHours().toString().padStart(2, "0");
    const min = d.getMinutes().toString().padStart(2, "0");
    return `${m} ${day} ${h}:${min}`;
  } catch {
    return iso;
  }
}

export function QueuePane({
  submissions,
  selectedId,
  onSelect,
  isVerifierAdmin = false,
  emptyStateMode = "none",
  theme = "field",
  className,
}: QueuePaneProps) {
  const isPaper = theme === "paper";
  const [filterQuery, setFilterQuery] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<"ALL" | "HIGH" | "MEDIUM">("ALL");

  // Client-side quick filter
  const filtered = React.useMemo(() => {
    return submissions.filter((sub) => {
      const matchesText =
        filterQuery.trim() === "" ||
        sub.projectTitle.toLowerCase().includes(filterQuery.toLowerCase()) ||
        sub.ownerOrgName.toLowerCase().includes(filterQuery.toLowerCase()) ||
        sub.activityType.toLowerCase().includes(filterQuery.toLowerCase());

      const matchesSeverity =
        severityFilter === "ALL" ||
        (severityFilter === "HIGH" && sub.findingCounts.high > 0) ||
        (severityFilter === "MEDIUM" && sub.findingCounts.medium > 0);

      return matchesText && matchesSeverity;
    });
  }, [submissions, filterQuery, severityFilter]);

  // Partition escalated items if verifier admin
  const { pinnedItems, regularItems } = React.useMemo(() => {
    if (isVerifierAdmin) {
      const pinned = filtered
        .filter((s) => s.status === "ESCALATED" || s.isEscalated)
        .sort(compareSeverity);
      const regular = filtered
        .filter((s) => s.status !== "ESCALATED" && !s.isEscalated)
        .sort(compareSeverity);
      return { pinnedItems: pinned, regularItems: regular };
    }
    return {
      pinnedItems: [],
      regularItems: [...filtered].sort(compareSeverity),
    };
  }, [filtered, isVerifierAdmin]);

  // Empty state handling per docs/15-UI-STATES.md §2
  if (emptyStateMode === "no-assignments") {
    return (
      <aside
        className={cn(
          "w-full sm:w-[280px] lg:w-[320px] flex-shrink-0 flex flex-col border-r p-4",
          isPaper ? "border-paper-rule bg-paper" : "border-field-hairline bg-field-canopy",
          className
        )}
      >
        <EmptyState
          title="Your review queue"
          reason="Your organisation is not assigned to any projects yet. A platform administrator assigns verifier organisations to the projects they audit."
          honestNote="Independent verifier organizations only review assigned workloads. Platform administrators assign audit lanes."
          action={{
            label: "Contact support",
            onClick: () => alert("Redirecting to administrator support..."),
          }}
          theme={theme}
        />
      </aside>
    );
  }

  if (emptyStateMode === "queue-clear" || (submissions.length === 0 && filterQuery === "")) {
    return (
      <aside
        className={cn(
          "w-full sm:w-[280px] lg:w-[320px] flex-shrink-0 flex flex-col border-r p-4",
          isPaper ? "border-paper-rule bg-paper" : "border-field-hairline bg-field-canopy",
          className
        )}
      >
        <EmptyState
          title="Queue clear"
          reason="Nothing is awaiting your review. New submissions appear here automatically once forensic processing completes."
          honestNote="Last reviewed 14 minutes ago."
          theme={theme}
        />
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "w-full sm:w-[280px] lg:w-[320px] flex-shrink-0 flex flex-col border-r transition-colors select-none",
        isPaper ? "border-paper-rule bg-paper" : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      {/* Pane Header */}
      <div
        className={cn(
          "p-3.5 border-b space-y-2.5",
          isPaper ? "border-paper-rule bg-paper-card" : "border-field-hairline bg-field-canopy"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "text-xs font-medium",
                isPaper ? "text-paper-ink" : "text-field-text"
              )}
            >
              Review queue
            </h3>
            <span className="font-mono text-[11px] tabular-nums text-field-muted">
              ({filtered.length})
            </span>
          </div>

          {isVerifierAdmin && (
            <span
              title="Escalated submissions are pinned to the top for administrator review"
              className={cn(
                "flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border select-none",
                isPaper
                  ? "bg-[color-mix(in_srgb,var(--paper-chain)_14%,transparent)] border-[color-mix(in_srgb,var(--paper-chain)_35%,transparent)] text-paper-chain"
                  : "bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] border-[color-mix(in_srgb,var(--chain)_35%,transparent)] text-chain"
              )}
            >
              <Pin className="size-3" /> Admin view
            </span>
          )}
        </div>

        {/* Quick Filter Bar */}
        <div className="relative">
          <Search
            className={cn(
              "absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5",
              isPaper ? "text-paper-muted" : "text-field-inert"
            )}
          />
          <input
            type="text"
            placeholder="Filter queue (j/k to move)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className={cn(
              "w-full rounded border pl-8 pr-3 py-1.5 text-xs transition-colors focus:outline-none",
              isPaper
                ? "border-paper-rule bg-paper text-paper-ink placeholder:text-paper-muted focus:border-paper-seal"
                : "border-field-hairline bg-field-raised text-field-text placeholder:text-field-inert focus:border-field-muted"
            )}
          />
        </div>

        {/* Filter Pills (Tint rule, sentence case, no solid fills) */}
        <div className="flex items-center gap-1 text-[11px] pt-0.5">
          <button
            type="button"
            onClick={() => setSeverityFilter("ALL")}
            className={cn(
              "px-2 py-0.5 rounded border transition-colors flex items-center gap-1",
              severityFilter === "ALL"
                ? isPaper
                  ? "bg-paper-card border-paper-rule text-paper-ink font-medium"
                  : "bg-field-raised border-field-muted text-field-text font-medium"
                : isPaper
                ? "border-paper-rule text-paper-muted hover:text-paper-ink"
                : "border-field-hairline text-field-muted hover:text-field-text"
            )}
          >
            <span>All</span>
            <span className="font-mono tabular-nums text-[10px]">({submissions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSeverityFilter("HIGH")}
            className={cn(
              "px-2 py-0.5 rounded border transition-colors flex items-center gap-1",
              severityFilter === "HIGH"
                ? "bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] text-fraud font-medium"
                : "border-field-hairline text-field-muted hover:text-field-text"
            )}
          >
            <span className="size-1 rounded-full bg-fraud" />
            <span>High risk</span>
          </button>
          <button
            type="button"
            onClick={() => setSeverityFilter("MEDIUM")}
            className={cn(
              "px-2 py-0.5 rounded border transition-colors flex items-center gap-1",
              severityFilter === "MEDIUM"
                ? "bg-[color-mix(in_srgb,var(--review)_14%,transparent)] border-[color-mix(in_srgb,var(--review)_35%,transparent)] text-review font-medium"
                : "border-field-hairline text-field-muted hover:text-field-text"
            )}
          >
            <span className="size-1 rounded-full bg-review" />
            <span>Medium</span>
          </button>
        </div>
      </div>

      {/* Queue Item List */}
      <div className="flex-1 overflow-y-auto divide-y divide-inherit">
        {/* Filtered-to-nothing empty state */}
        {filtered.length === 0 && (
          <div className="p-4">
            <EmptyState
              title="No submissions match these filters"
              reason={`${submissions.length} submissions are in your queue. None match "${filterQuery}".`}
              action={{
                label: "Clear filter",
                onClick: () => {
                  setFilterQuery("");
                  setSeverityFilter("ALL");
                },
              }}
              theme={theme}
            />
          </div>
        )}

        {/* Pinned Escalations Section (Verifier Admin) */}
        {pinnedItems.length > 0 && (
          <div className="border-b border-chain/30">
            <div
              className={cn(
                "px-3 py-1.5 text-[11px] flex items-center justify-between",
                isPaper
                  ? "bg-paper-card text-paper-chain"
                  : "bg-field-canopy text-chain"
              )}
            >
              <span className="flex items-center gap-1 font-medium">
                <Pin className="size-3" /> Pinned escalations
              </span>
              <span className="font-mono tabular-nums text-[10px]">
                {pinnedItems.length} awaiting deciding vote
              </span>
            </div>
            {pinnedItems.map((sub) => (
              <QueueRow
                key={sub.id}
                submission={sub}
                isSelected={sub.id === selectedId}
                onSelect={() => onSelect(sub.id)}
                isPinned
                theme={theme}
              />
            ))}
          </div>
        )}

        {/* Regular Queue Items */}
        {regularItems.map((sub) => (
          <QueueRow
            key={sub.id}
            submission={sub}
            isSelected={sub.id === selectedId}
            onSelect={() => onSelect(sub.id)}
            theme={theme}
          />
        ))}
      </div>
    </aside>
  );
}

interface QueueRowProps {
  submission: LabSubmission;
  isSelected: boolean;
  onSelect: () => void;
  isPinned?: boolean;
  theme?: "field" | "paper";
}

/**
 * QueueRow — Exactly four elements per docs/18-VISUAL-CORRECTION.md §2:
 * 1. Project title
 * 2. Submitted time (monospace)
 * 3. One severity summary chip (not three separate pills)
 * 4. Status
 */
function QueueRow({
  submission,
  isSelected,
  onSelect,
  isPinned = false,
  theme = "field",
}: QueueRowProps) {
  const isPaper = theme === "paper";

  // Single severity summary determination
  const summarySeverity: "high" | "medium" | "low" | "info" =
    submission.findingCounts.high > 0
      ? "high"
      : submission.findingCounts.medium > 0
      ? "medium"
      : submission.findingCounts.low > 0
      ? "low"
      : "info";

  const summaryLabel =
    submission.findingCounts.high > 0
      ? "High"
      : submission.findingCounts.medium > 0
      ? "Medium"
      : submission.findingCounts.low > 0
      ? "Low"
      : "Clean";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "p-3 text-left transition-colors cursor-pointer border-l-2 outline-none select-none",
        isSelected
          ? isPaper
            ? "bg-paper-card border-l-paper-seal"
            : "bg-field-raised border-l-field-text"
          : isPinned
          ? isPaper
            ? "border-l-paper-chain hover:bg-paper-card"
            : "border-l-chain hover:bg-field-raised/50"
          : isPaper
          ? "border-l-transparent hover:bg-paper-card"
          : "border-l-transparent hover:bg-field-raised/50"
      )}
    >
      {/* Element 1: Project title */}
      <div className="flex items-baseline justify-between gap-2">
        <h4
          className={cn(
            "text-xs leading-snug line-clamp-1",
            isSelected ? "font-semibold text-field-text" : "font-normal text-field-text"
          )}
        >
          {submission.projectTitle}
        </h4>

        {/* Element 2: Submitted time (in monospace) */}
        <span className="font-mono text-[11px] tabular-nums text-field-muted shrink-0">
          {formatTimestamp(submission.submittedAt)}
        </span>
      </div>

      {/* Row 2: Element 3 (One severity summary chip) & Element 4 (Status) */}
      <div className="flex items-center justify-between pt-2">
        {/* Element 3: ONE severity summary chip */}
        <SeverityChip
          severity={summarySeverity}
          label={summaryLabel}
          theme={theme}
        />

        {/* Element 4: Status badge */}
        <div className="flex items-center gap-1.5">
          {submission.userHasDecided && (
            <span
              title="You decided"
              className="size-1.5 rounded-full bg-verified shrink-0"
            />
          )}
          <StatusBadge status={submission.status} theme={theme} />
        </div>
      </div>
    </div>
  );
}
