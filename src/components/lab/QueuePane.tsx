"use client";

import * as React from "react";
import { Pin, Search } from "lucide-react";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { SeverityChip } from "@/src/components/severity-chip/severity-chip";
import { EmptyState } from "@/src/components/empty-state/empty-state";
import type { LabSubmission } from "./fixtures";
import { cn } from "@/src/lib/utils";

/** What a queue row needs. A LabSubmission satisfies it; so does a real queue item with no images. */
export type QueueItem = Pick<
  LabSubmission,
  "id" | "projectTitle" | "ownerOrgName" | "activityType" | "submittedAt" | "status" | "userHasDecided" | "isEscalated" | "findingCounts"
>;

export interface QueuePaneProps {
  /** Submissions awaiting review */
  submissions: QueueItem[];
  /** Currently selected submission id */
  selectedId?: string;
  /** Selection handler */
  onSelect: (submissionId: string) => void;
  /** How many are waiting in all, when `submissions` is a capped page of them */
  totalCount?: number;
  /** Whether the active viewer is a Verifier Administrator (pins ESCALATED items) */
  isVerifierAdmin?: boolean;
  /** Empty state mode */
  emptyStateMode?: "none" | "no-assignments" | "queue-clear" | "not-a-verifier";
  /** Optional theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * Severity weight comparator for sorting:
 * HIGH findings first, then MEDIUM, then LOW, then newest submittedAt.
 */
export function compareSeverity(a: QueueItem, b: QueueItem): number {
  if (b.findingCounts.high !== a.findingCounts.high) return b.findingCounts.high - a.findingCounts.high;
  if (b.findingCounts.medium !== a.findingCounts.medium) return b.findingCounts.medium - a.findingCounts.medium;
  if (b.findingCounts.low !== a.findingCounts.low) return b.findingCounts.low - a.findingCounts.low;
  return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
}

type QueueFilter = "ALL" | "HIGH" | "ESCALATED" | "MINE";
const QUEUE_FILTERS: Record<QueueFilter, { label: string; tone?: "fraud" | "review"; test: (s: QueueItem) => boolean }> = {
  ALL: { label: "All", test: () => true },
  HIGH: { label: "High severity", tone: "fraud", test: (s) => s.findingCounts.high > 0 },
  ESCALATED: { label: "Escalated", tone: "review", test: (s) => s.status === "ESCALATED" || Boolean(s.isEscalated) },
  MINE: { label: "Awaiting my vote", test: (s) => !s.userHasDecided },
};

/** Rows drawn at first and per step. Rows are a fixed 72px, so the list never jumps as it grows. */
const WINDOW = 40;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Oct 09:42", in UTC so the server render and the browser agree. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function QueuePane({
  submissions,
  selectedId,
  onSelect,
  totalCount,
  isVerifierAdmin = false,
  emptyStateMode = "none",
  theme = "field",
  className,
}: QueuePaneProps) {
  const isPaper = theme === "paper";
  const [filterQuery, setFilterQuery] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<QueueFilter>("ALL");
  const listRef = React.useRef<HTMLDivElement>(null);

  // Client-side quick filter: the text narrows the list, and each pill counts what the text left
  const matching = React.useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return submissions.filter(
      (sub) => q === "" || sub.projectTitle.toLowerCase().includes(q) || sub.ownerOrgName.toLowerCase().includes(q) || sub.activityType.toLowerCase().includes(q),
    );
  }, [submissions, filterQuery]);
  const filtered = React.useMemo(() => matching.filter(QUEUE_FILTERS[severityFilter].test), [matching, severityFilter]);

  // Partition escalated items if verifier admin
  const { pinnedItems, regularItems } = React.useMemo(() => {
    if (isVerifierAdmin) {
      return {
        pinnedItems: filtered.filter((s) => s.status === "ESCALATED" || s.isEscalated).sort(compareSeverity),
        regularItems: filtered.filter((s) => s.status !== "ESCALATED" && !s.isEscalated).sort(compareSeverity),
      };
    }
    return { pinnedItems: [], regularItems: [...filtered].sort(compareSeverity) };
  }, [filtered, isVerifierAdmin]);

  // Only a window of rows is in the page: a queue of hundreds would otherwise be thousands of
  // elements to lay out. The selected row is always inside it, wherever j/k or a link put it.
  const [shown, setShown] = React.useState(WINDOW);
  const selectedIndex = regularItems.findIndex((s) => s.id === selectedId);
  const limit = Math.max(shown, selectedIndex + WINDOW / 4);
  const visibleRegular = regularItems.slice(0, limit);
  const hidden = regularItems.length - visibleRegular.length;
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const focusAfterGrow = React.useRef<number | null>(null);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || hidden <= 0) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setShown((n) => n + WINDOW), { root: listRef.current, rootMargin: "0px 0px 360px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hidden]);

  // a key that moved past the last drawn row focuses its target once the window has grown
  React.useEffect(() => {
    const at = focusAfterGrow.current;
    if (at === null) return;
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    if (rows && rows.length > at) {
      focusAfterGrow.current = null;
      rows[at]?.focus();
    }
  }, [limit]);

  // j/k change the selection from outside the list; keep the row in view.
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Up / Down / Home / End move FOCUS between rows without selecting; Enter selects.
  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (rows.length === 0) return;
    e.preventDefault();
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const total = pinnedItems.length + regularItems.length;
    // past the drawn rows: grow the window, then focus the row once it exists
    if (hidden > 0 && (e.key === "End" || (e.key === "ArrowDown" && at === rows.length - 1))) {
      focusAfterGrow.current = e.key === "End" ? total - 1 : at + 1;
      setShown(e.key === "End" ? regularItems.length : (n) => n + WINDOW);
      return;
    }
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? rows.length - 1
      : e.key === "ArrowDown" ? Math.min(rows.length - 1, at + 1)
      : Math.max(0, at <= 0 ? 0 : at - 1);
    rows[next]?.focus();
  };

  const paneClass = cn(
    "flex min-h-0 min-w-0 flex-col border-r",
    isPaper ? "border-paper-rule bg-paper" : "border-field-hairline bg-field-canopy",
    className
  );

  // Empty state handling per docs/15-UI-STATES.md §2
  if (emptyStateMode === "no-assignments") {
    return (
      <aside className={cn(paneClass, "px-5 pb-4 pt-14")}>
        <EmptyState
          title="Your review queue"
          reason="Your organisation has not taken on a project yet, so nothing can reach this queue."
          honestNote="A Delta operator assigns each new project to an independent verifier organisation. Organisations never choose their own."
          theme={theme}
        />
      </aside>
    );
  }

  if (emptyStateMode === "not-a-verifier") {
    return (
      <aside className={cn(paneClass, "px-5 pb-4 pt-14")}>
        <EmptyState
          title="No review queue"
          reason="The Evidence Lab is for verifier organisations. Your organisation does not review submissions, so there is nothing to show here."
          honestNote="Project owners submit evidence and funders read verified outcomes. Both are on your dashboard."
          theme={theme}
        />
      </aside>
    );
  }

  if (emptyStateMode === "queue-clear" || (submissions.length === 0 && filterQuery === "")) {
    return (
      <aside className={cn(paneClass, "px-5 pb-4 pt-14")}>
        <EmptyState
          title="Queue clear"
          reason="Nothing is awaiting your review. New submissions appear here automatically once forensic processing completes."
          theme={theme}
        />
      </aside>
    );
  }

  const chip = (active: boolean, tone?: "fraud" | "review") =>
    cn(
      "flex h-6 items-center gap-1 rounded-sm border px-2 text-xs transition-colors duration-[120ms]",
      active && tone === "fraud" && "border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] text-fraud",
      active && tone === "review" && "border-[color-mix(in_srgb,var(--review)_35%,transparent)] bg-[color-mix(in_srgb,var(--review)_14%,transparent)] text-review",
      active && !tone && "border-field-muted bg-field-raised text-field-text",
      !active && "border-field-hairline text-field-muted hover:text-field-text"
    );

  return (
    <aside className={cn(paneClass, "select-none")}>
      {/* Header: heading, then its content 16px below, rows of controls 8px apart */}
      <div className={cn("shrink-0 border-b px-5 py-4", isPaper ? "border-paper-rule" : "border-field-hairline")}>
        <div className="flex h-6 items-center justify-between pr-10">
          <h2 className={cn("text-base font-medium leading-6", isPaper ? "text-paper-ink" : "text-field-text")}>
            Review queue
            <span className="ml-2 font-mono text-[13px] font-normal tabular-nums text-field-muted">
              {filtered.length}
              {totalCount !== undefined && totalCount > submissions.length ? ` of ${totalCount}` : ""}
            </span>
          </h2>
          {isVerifierAdmin && (
            <span
              title="Escalated submissions are pinned to the top for administrator review"
              className="flex items-center gap-1 rounded-sm border border-[color-mix(in_srgb,var(--chain)_35%,transparent)] bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] px-2 text-xs leading-5 text-chain"
            >
              <Pin className="size-3" aria-hidden="true" /> Admin view
            </span>
          )}
        </div>

        <div className="relative mt-4">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-field-inert" />
          <input
            type="text"
            aria-label="Filter the review queue"
            placeholder="Filter queue"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className={cn(
              "h-8 w-full rounded-sm border pl-9 pr-3 text-[13px] outline-none transition-colors duration-[120ms]",
              isPaper
                ? "border-paper-rule bg-paper text-paper-ink placeholder:text-paper-muted focus:border-paper-seal"
                : "border-field-hairline bg-field-raised text-field-text placeholder:text-field-inert focus:border-field-muted"
            )}
          />
        </div>

        <div role="group" aria-label="Show" className="mt-2 flex flex-wrap items-center gap-2">
          {(Object.keys(QUEUE_FILTERS) as QueueFilter[]).map((f) => {
            const { label, tone, test } = QUEUE_FILTERS[f];
            return (
              <button key={f} type="button" aria-pressed={severityFilter === f} onClick={() => setSeverityFilter(f)} className={chip(severityFilter === f, tone)}>
                {tone && <span className={cn("size-1 rounded-full", tone === "fraud" ? "bg-fraud" : "bg-review")} aria-hidden="true" />}
                {label} <span className="font-mono tabular-nums">{matching.filter(test).length}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Submissions awaiting review"
        onKeyDown={onListKeyDown}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {filtered.length === 0 && (
          <div className="p-5">
            <EmptyState
              title="No submissions match these filters"
              reason={`${submissions.length} submissions are in your queue. ${filterQuery ? `None match "${filterQuery}"` : "None of them"}${severityFilter === "ALL" ? "" : ` under "${QUEUE_FILTERS[severityFilter].label}"`}.`}
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

        {pinnedItems.length > 0 && (
          <div role="group" aria-label="Pinned escalations">
            <div className="flex h-8 items-center justify-between px-5 text-[13px] text-chain">
              <span className="flex items-center gap-1">
                <Pin className="size-3" aria-hidden="true" /> Pinned escalations
              </span>
              <span className="font-mono tabular-nums">{pinnedItems.length} awaiting</span>
            </div>
            {pinnedItems.map((sub) => (
              <QueueRow
                key={sub.id}
                submission={sub}
                isSelected={sub.id === selectedId}
                isTabStop={sub.id === selectedId}
                onSelect={() => onSelect(sub.id)}
                theme={theme}
              />
            ))}
          </div>
        )}

        {visibleRegular.map((sub, i) => (
          <QueueRow
            key={sub.id}
            submission={sub}
            isSelected={sub.id === selectedId}
            // exactly one row is in the tab order: the selected one, else the first
            isTabStop={sub.id === selectedId || (selectedId === undefined && i === 0 && pinnedItems.length === 0)}
            onSelect={() => onSelect(sub.id)}
            theme={theme}
          />
        ))}

        {hidden > 0 && (
          <div ref={sentinelRef} className="flex h-[72px] items-center justify-center px-5">
            <button
              type="button"
              onClick={() => setShown((n) => n + WINDOW)}
              className="inline-flex h-9 items-center rounded-md border border-field-hairline px-3 text-[13px] text-field-muted transition-colors hover:text-field-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              Show {Math.min(WINDOW, hidden)} more <span className="ml-1 font-mono tabular-nums">· {hidden} not shown</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

interface QueueRowProps {
  submission: QueueItem;
  isSelected: boolean;
  isTabStop: boolean;
  onSelect: () => void;
  theme?: "field" | "paper";
}

/**
 * QueueRow — fixed 72px (docs/19-LAYOUT-SPEC.md §6) so j/k never makes the list jump.
 * Line one: the project title, ellipsised. Line two: one severity chip, the time, the status.
 */
function QueueRow({ submission, isSelected, isTabStop, onSelect, theme = "field" }: QueueRowProps) {
  const isPaper = theme === "paper";
  const c = submission.findingCounts;

  const severity: "high" | "medium" | "low" | "info" = c.high > 0 ? "high" : c.medium > 0 ? "medium" : c.low > 0 ? "low" : "info";
  const label = c.high > 0 ? "High" : c.medium > 0 ? "Medium" : c.low > 0 ? "Low" : "Clean";

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={isTabStop ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex h-[72px] cursor-pointer flex-col justify-between border-l-2 py-3 pl-[18px] pr-4 transition-colors duration-[120ms]",
        // keyboard focus is its own signal: an inset ring, distinct from the selected state
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal",
        isSelected
          ? isPaper
            ? "border-l-paper-seal bg-paper-card"
            : "border-l-field-muted bg-field-raised"
          : isPaper
          ? "border-l-transparent hover:bg-paper-card"
          : "border-l-transparent hover:bg-field-raised"
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-[15px] leading-[21px]", isPaper ? "text-paper-ink" : "text-field-text")}>
          {submission.projectTitle}
        </span>
        {submission.userHasDecided && (
          <span title="You have decided" className="size-1.5 shrink-0 rounded-full bg-verified">
            <span className="sr-only">You have decided</span>
          </span>
        )}
      </span>

      <span className="flex h-6 items-center">
        <span className="flex min-w-0 items-center gap-2">
          <SeverityChip severity={severity} label={label} theme={theme} />
          <time dateTime={submission.submittedAt} title={submission.submittedAt} className="min-w-0 truncate font-mono text-[13px] tabular-nums text-field-muted">
            {formatTimestamp(submission.submittedAt)}
          </time>
        </span>
        <span className="ml-auto shrink-0 pl-1">
          <StatusBadge status={submission.status} theme={theme} />
        </span>
      </span>
    </div>
  );
}
