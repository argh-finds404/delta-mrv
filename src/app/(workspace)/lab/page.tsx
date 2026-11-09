"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, ImageOff, Keyboard, ShieldCheck, UserCheck, X } from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";
import {
  QueuePane,
  EvidencePair,
  FindingCard,
  DecisionForm,
  BoundaryPlot,
  compareSeverity,
  type DecisionAction,
  type DecisionPayload,
  type QueueItem,
} from "@/src/components/lab";
import { sampleLabSubmissions, type LabSubmission } from "@/src/components/lab/fixtures";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { EmptyState } from "@/src/components/empty-state/empty-state";
import { cn } from "@/src/lib/utils";

const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Next submission in queue", keys: ["j"] },
  { label: "Previous submission in queue", keys: ["k"] },
  { label: "Move focus through the queue", keys: ["↑", "↓"] },
  { label: "Open the focused submission", keys: ["Enter"] },
  { label: "Write the reason, then approve", keys: ["a"] },
  { label: "Write the reason, then reject", keys: ["r"] },
  { label: "Write the reason, then request more proof", keys: ["m"] },
  { label: "Step the comparison slider 2%", keys: ["←", "→"] },
  { label: "Step the comparison slider 10%", keys: ["Shift", "←", "→"] },
  { label: "Jump the slider to either end", keys: ["Home", "End"] },
  { label: "Show or hide this sheet", keys: ["?"] },
  { label: "Close", keys: ["Esc"] },
];

/** A queue row plus what the decision bar needs. */
type RealItem = QueueItem & {
  round: number;
  approvalsCount: number;
  rejectionsCount: number;
  requiredQuorum: number;
  userDecision?: DecisionAction;
  files: { id: string; role: "BEFORE" | "AFTER" | "SUPPLEMENT"; round: number }[];
};

/** The shape of GET /api/lab/queue (dates arrive as strings). */
type ApiOverview = {
  isVerifier: boolean;
  hasAssignments: boolean;
  total: number;
  items: {
    id: string;
    status: QueueItem["status"];
    round: number;
    submittedAt: string;
    projectTitle: string;
    ownerOrgName: string;
    activityType: string;
    approvals: number;
    rejections: number;
    userDecision: DecisionAction | null;
    findingCounts: QueueItem["findingCounts"];
    files: { id: string; role: "BEFORE" | "AFTER" | "SUPPLEMENT"; round: number }[];
  }[];
};

type Source =
  | { kind: "loading" }
  | { kind: "fixtures" } // development only, ?fixtures: the design-review data
  | { kind: "real" }
  | { kind: "error"; message: string; signedOut: boolean };

type QueueState = "ok" | "not-a-verifier" | "no-assignments" | "queue-clear";

const QUORUM = 2; // docs/01-FEATURE-LOCK.md

const sentenceCase = (enumName: string) => {
  const s = enumName.toLowerCase().replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function EvidenceLabPage() {
  const router = useRouter();
  const [source, setSource] = React.useState<Source>({ kind: "loading" });
  const [queueState, setQueueState] = React.useState<QueueState>("ok");
  const [items, setItems] = React.useState<RealItem[]>([]);
  const [total, setTotal] = React.useState<number>(0); // everything waiting; items is a capped page of it
  const [fixtureSubs, setFixtureSubs] = React.useState<LabSubmission[]>(sampleLabSubmissions);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  const [isVerifierAdmin, setIsVerifierAdmin] = React.useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = React.useState<boolean>(false);

  // Bumping this re-fetches the queue (after a decision, or "Try again").
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  React.useEffect(() => {
    let ignore = false;
    async function load() {
      await Promise.resolve(); // yield: state is never set synchronously inside the effect
      if (ignore) return;
      // ?fixtures swaps in the design-review data. Development builds only.
      if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("fixtures")) {
        setSource({ kind: "fixtures" });
        setSelectedId((cur) => cur || sampleLabSubmissions[0].id);
        return;
      }
      try {
        const res = await fetch("/api/lab/queue", { cache: "no-store" });
        if (ignore) return;
        if (res.status === 401) {
          setSource({ kind: "error", message: "Your session has expired.", signedOut: true });
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ApiOverview;
        if (ignore) return;
        const mapped: RealItem[] = data.items
          .map((s) => ({
            id: s.id,
            projectTitle: s.projectTitle,
            ownerOrgName: s.ownerOrgName,
            activityType: sentenceCase(s.activityType),
            submittedAt: s.submittedAt,
            status: s.status,
            round: s.round,
            findingCounts: s.findingCounts,
            userHasDecided: s.userDecision !== null,
            userDecision: s.userDecision ?? undefined,
            isEscalated: s.status === "ESCALATED",
            approvalsCount: s.approvals,
            rejectionsCount: s.rejections,
            requiredQuorum: QUORUM,
            files: s.files ?? [],
          }))
          .sort(compareSeverity);
        setItems(mapped);
        setTotal(data.total);
        setQueueState(!data.isVerifier ? "not-a-verifier" : !data.hasAssignments ? "no-assignments" : mapped.length === 0 ? "queue-clear" : "ok");
        setSelectedId((cur) => (mapped.some((i) => i.id === cur) ? cur : (mapped[0]?.id ?? "")));
        setSource({ kind: "real" });
      } catch {
        if (!ignore) setSource({ kind: "error", message: "The review queue could not be loaded. Nothing was changed.", signedOut: false });
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const isFixtures = source.kind === "fixtures";
  const list: QueueItem[] = isFixtures ? fixtureSubs : items;
  const activeFixture = isFixtures ? (fixtureSubs.find((s) => s.id === selectedId) ?? fixtureSubs[0]) : undefined;
  const activeReal = !isFixtures ? items.find((i) => i.id === selectedId) : undefined;
  const active: QueueItem | undefined = activeFixture ?? activeReal;

  // What the queue and the centre show when there is nothing to review
  const emptyMode: "none" | "no-assignments" | "queue-clear" | "not-a-verifier" =
    source.kind === "real" && queueState !== "ok" ? queueState : "none";

  // Global Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keystrokes if typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        if (e.key === "Escape") target.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isShortcutsOpen) {
          e.preventDefault();
          setIsShortcutsOpen(false);
        }
      } else if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const i = list.findIndex((s) => s.id === selectedId);
        const next = e.key === "j" ? i + 1 : i - 1;
        if (next >= 0 && next < list.length) setSelectedId(list[next].id);
      } else if (e.key === "a" || e.key === "r" || e.key === "m") {
        // Every decision needs a written reason first: send the reviewer there.
        e.preventDefault();
        document.getElementById("decision-reason")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [list, selectedId, isShortcutsOpen]);

  // A committed decision. Real items go to the server; the queue then reloads, because the
  // server (not this page) decides whether the submission is approved, escalated or still open.
  const handleDecision = async (payload: DecisionPayload) => {
    if (isFixtures) {
      setFixtureSubs((prev) =>
        prev.map((sub) => {
          if (sub.id !== selectedId) return sub;
          const approvals = payload.action === "APPROVE" ? sub.approvalsCount + 1 : sub.approvalsCount;
          const rejections = payload.action === "REJECT" ? sub.rejectionsCount + 1 : sub.rejectionsCount;
          const status =
            approvals >= sub.requiredQuorum ? "APPROVED" : rejections >= sub.requiredQuorum ? "REJECTED" : approvals === 1 && rejections === 1 ? "ESCALATED" : sub.status;
          return { ...sub, userHasDecided: true, userDecision: payload.action, approvalsCount: approvals, rejectionsCount: rejections, status };
        })
      );
      return;
    }
    setDecisionError(null);
    try {
      const res = await fetch("/api/lab/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: selectedId, decision: payload.action, reason: payload.reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setDecisionError(body?.error ?? `The decision was not recorded (error ${res.status}). Nothing was changed.`);
        return;
      }
      reload();
    } catch {
      setDecisionError("The decision could not be sent. Nothing was recorded. Check your connection and try again.");
    }
  };

  const headerButton =
    "flex h-8 items-center gap-2 rounded-sm border border-field-hairline bg-field-raised px-3 text-[13px] text-field-muted transition-colors duration-[120ms] hover:text-field-text";

  const centreMessage = (() => {
    if (source.kind === "loading") return { title: "Loading the review queue", reason: "Fetching the submissions assigned to your organisation." };
    if (source.kind === "error") return { title: source.signedOut ? "Sign in again" : "The queue did not load", reason: source.message };
    if (emptyMode === "no-assignments") return { title: "Your review queue", reason: "Your organisation is not assigned to any projects yet. A platform administrator assigns verifier organisations to the projects they audit." };
    if (emptyMode === "not-a-verifier") return { title: "No review queue", reason: "The Evidence Lab is for verifier organisations. Your organisation does not review submissions, so there is nothing to show here." };
    return { title: "Queue clear", reason: "Nothing is awaiting your review. New submissions appear here automatically once forensic processing completes." };
  })();

  const showDetail = source.kind !== "loading" && source.kind !== "error" && emptyMode === "none" && active !== undefined;

  return (
    <div data-theme="field" className="flex h-screen flex-col overflow-hidden bg-field-abyss font-sans text-field-text">
      {/* Workspace bar: Wordmark, forest palette, no debug tabs */}
      <header className="flex h-12 shrink-0 select-none items-center justify-between border-b border-field-hairline bg-field-canopy px-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" aria-label="Delta Dashboard" className="transition-opacity hover:opacity-85">
            <Wordmark className="text-field-text" />
          </Link>
          <span className="text-field-hairline" aria-hidden="true">/</span>
          <span className="text-xs font-mono uppercase tracking-wider text-field-muted">Evidence Lab</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-field-muted hover:text-field-text transition-colors"
          >
            Dashboard
          </Link>

          <Link
            href="/atlas"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-field-muted hover:text-field-text transition-colors"
          >
            <Compass className="size-3.5" aria-hidden="true" />
            <span>Atlas</span>
          </Link>

          <div className="hidden sm:block h-4 w-px bg-field-hairline" aria-hidden="true" />

          <button
            type="button"
            aria-pressed={isVerifierAdmin}
            onClick={() => setIsVerifierAdmin(!isVerifierAdmin)}
            title="Toggle between regular verifier and verifier administrator (pins escalated cases)"
            className={cn(
              headerButton,
              isVerifierAdmin &&
                "border-[color-mix(in_srgb,var(--chain)_35%,transparent)] bg-[color-mix(in_srgb,var(--chain)_14%,transparent)] text-chain hover:text-chain"
            )}
          >
            <UserCheck className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Admin view</span>
            <span>{isVerifierAdmin ? "on" : "off"}</span>
          </button>

          <button type="button" onClick={() => setIsShortcutsOpen(true)} title="View keyboard shortcuts (?)" className={headerButton}>
            <Keyboard className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="rounded-sm border border-field-hairline bg-field-canopy px-1 font-mono text-xs">?</kbd>
          </button>
        </div>
      </header>

      {/* Three panes (docs/19-LAYOUT-SPEC.md §2). From 1280px the wrapper below is `display: contents`,
          so evidence and findings become the second and third columns; under 1280px they stack. */}
      <div className="lab-grid min-h-0 flex-1">
        {source.kind === "loading" || source.kind === "error" ? (
          <aside className="min-w-0 border-r border-field-hairline bg-field-canopy px-5 py-4 text-[13px] text-field-muted">
            {source.kind === "loading" ? "Loading the review queue…" : "No queue loaded."}
          </aside>
        ) : (
          <QueuePane
            submissions={list}
            totalCount={isFixtures ? undefined : total}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            isVerifierAdmin={isVerifierAdmin}
            emptyStateMode={emptyMode}
          />
        )}

        {showDetail && active ? (
          <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto xl:contents">
            {/* Evidence: the comparison is the reviewer's core act, so it takes what is left */}
            <main
              aria-label="Evidence"
              className="flex h-[max(34rem,calc(100dvh-3rem))] min-h-0 min-w-0 shrink-0 flex-col gap-4 bg-field-abyss px-5 py-4 xl:h-auto xl:shrink xl:overflow-y-auto xl:border-r xl:border-field-hairline"
            >
              {/* One line: project, organisation, state (docs/18 §2) */}
              <div className="flex h-8 shrink-0 items-center justify-between gap-4">
                <h1 className="min-w-0 truncate text-base font-medium leading-6 text-field-text">
                  {active.projectTitle}
                  <span className="font-normal text-field-muted"> · {active.ownerOrgName}</span>
                </h1>
                <StatusBadge status={active.status} />
              </div>

              {activeFixture ? (
                <EvidencePair
                  className="flex-1"
                  before={{ ...activeFixture.beforeImage, gps: activeFixture.exif.gps }}
                  after={{ ...activeFixture.afterImage, gps: activeFixture.exif.gps }}
                  beforeLabel="Before"
                  afterLabel="After"
                  details={
                    <div className="space-y-3">
                      <dl className="space-y-1">
                        <div className="flex items-baseline justify-between gap-4">
                          <dt className="text-field-muted">Activity</dt>
                          <dd className="text-field-text">{activeFixture.activityType}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-4">
                          <dt className="text-field-muted">Camera</dt>
                          <dd className="text-field-text">{activeFixture.exif.cameraModel ?? "Embedded sensor"}</dd>
                        </div>
                      </dl>
                      <BoundaryPlot
                        gps={activeFixture.exif.gps}
                        insideBoundary={activeFixture.exif.insideBoundary}
                        distanceMeters={activeFixture.exif.distanceToBoundaryMeters}
                        cameraModel={activeFixture.exif.cameraModel}
                      />
                    </div>
                  }
                />
              ) : activeReal &&
                activeReal.files.some((f) => f.role === "BEFORE" && f.round === activeReal.round) &&
                activeReal.files.some((f) => f.role === "AFTER" && f.round === activeReal.round) ? (
                (() => {
                  const beforeFile = activeReal.files.find((f) => f.role === "BEFORE" && f.round === activeReal.round)!;
                  const afterFile = activeReal.files.find((f) => f.role === "AFTER" && f.round === activeReal.round)!;
                  return (
                    <EvidencePair
                      className="flex-1"
                      before={{
                        url: `/api/evidence/${beforeFile.id}`,
                        sha256: beforeFile.id,
                        capturedAt: activeReal.submittedAt,
                        dhash: "—",
                      }}
                      after={{
                        url: `/api/evidence/${afterFile.id}`,
                        sha256: afterFile.id,
                        capturedAt: activeReal.submittedAt,
                        dhash: "—",
                      }}
                      beforeLabel="Before"
                      afterLabel="After"
                      details={
                        <div className="space-y-3">
                          <dl className="space-y-1">
                            <div className="flex items-baseline justify-between gap-4">
                              <dt className="text-field-muted">Activity</dt>
                              <dd className="text-field-text">{activeReal.activityType}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-4">
                              <dt className="text-field-muted">Review round</dt>
                              <dd className="font-mono tabular-nums text-field-text">{activeReal.round}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-4">
                              <dt className="text-field-muted">Submitted</dt>
                              <dd className="font-mono tabular-nums text-field-text">
                                {activeReal.submittedAt.slice(0, 16).replace("T", " ")} UTC
                              </dd>
                            </div>
                          </dl>
                        </div>
                      }
                    />
                  );
                })()
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-field-hairline bg-field-canopy p-8 text-center">
                  <ImageOff className="size-6 text-field-muted" aria-hidden="true" />
                  <h2 className="text-base font-medium text-field-text">The photographs are not available yet</h2>
                  <p className="prose-column text-[13px] leading-5 text-field-muted">
                    This submission is a real record, but its images live in private storage, which is connected in Stage 3. You can read the
                    record and decide on it, though without the pictures there is little to decide on.
                  </p>
                  <dl className="mt-1 space-y-1 text-[13px] leading-5">
                    <div className="flex justify-between gap-8">
                      <dt className="text-field-muted">Activity</dt>
                      <dd className="text-field-text">{active.activityType}</dd>
                    </div>
                    <div className="flex justify-between gap-8">
                      <dt className="text-field-muted">Review round</dt>
                      <dd className="font-mono tabular-nums text-field-text">{activeReal?.round}</dd>
                    </div>
                    <div className="flex justify-between gap-8">
                      <dt className="text-field-muted">Submitted</dt>
                      <dd className="font-mono tabular-nums text-field-text">{active.submittedAt.slice(0, 16).replace("T", " ")} UTC</dd>
                    </div>
                  </dl>
                </div>
              )}
            </main>

            {/* Findings: the list scrolls, the decision bar stays put (from 1280px) */}
            <aside aria-label="Findings and decision" className="flex min-w-0 flex-col border-field-hairline bg-field-canopy max-xl:border-t xl:min-h-0">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="max-w-[640px]">
                  <h2 className="mb-4 flex items-baseline gap-2 text-base font-medium leading-6 text-field-text">
                    Findings
                    <span className="font-mono text-[13px] font-normal tabular-nums text-field-muted">
                      {activeFixture ? activeFixture.findings.length : Object.values(active.findingCounts).reduce((a, b) => a + b, 0)}
                    </span>
                  </h2>

                  {activeFixture && activeFixture.findings.length > 0 ? (
                    <div className="space-y-2">
                      {activeFixture.findings
                        .slice()
                        .sort((a, b) => {
                          const order = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
                          return order[a.severity] - order[b.severity];
                        })
                        .map((finding) => (
                          <FindingCard key={finding.id} finding={finding} />
                        ))}
                    </div>
                  ) : activeFixture ? (
                    <div className="space-y-1 rounded-lg border border-field-hairline bg-field-raised p-4 text-[13px] leading-5">
                      <p className="flex items-center gap-2 text-[15px] leading-[21px] text-field-text">
                        <ShieldCheck className="size-4 text-verified" aria-hidden="true" />
                        No findings
                      </p>
                      <p className="text-field-muted">All checks ran and none raised a finding. The submission still needs independent review.</p>
                    </div>
                  ) : (
                    // Real items: say only what is true. Forensics has not run on seeded data.
                    <div className="space-y-1 rounded-lg border border-field-hairline bg-field-raised p-4 text-[13px] leading-5">
                      <p className="text-[15px] leading-[21px] text-field-text">No findings recorded</p>
                      <p className="text-field-muted">No forensic findings are stored for this submission. That is not the same as the checks having passed.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Read-only below 1024px (docs/19 §2) */}
              <div className="shrink-0 border-t border-field-hairline px-5 py-4 lg:hidden">
                <p role="note" className="rounded-lg border border-field-hairline bg-field-raised p-4 text-[13px] leading-5 text-field-muted">
                  Open the Lab on a larger screen to decide. You can read everything here.
                </p>
              </div>

              <div className="shrink-0 border-t border-field-hairline px-5 py-4 max-lg:hidden">
                {decisionError && (
                  <p
                    role="alert"
                    className="mb-3 max-w-[640px] rounded-sm border border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] px-3 py-2 text-[13px] leading-5 text-fraud"
                  >
                    {decisionError}
                  </p>
                )}
                <DecisionForm
                  className="max-w-[640px] rounded-none border-0 bg-transparent p-0"
                  submissionId={active.id}
                  approvalsCount={activeFixture ? activeFixture.approvalsCount : (activeReal?.approvalsCount ?? 0)}
                  rejectionsCount={activeFixture ? activeFixture.rejectionsCount : (activeReal?.rejectionsCount ?? 0)}
                  requiredQuorum={activeFixture ? activeFixture.requiredQuorum : QUORUM}
                  isEscalated={Boolean(active.isEscalated) || active.status === "ESCALATED"}
                  userHasDecided={active.userHasDecided}
                  userDecision={activeFixture ? activeFixture.userDecision : activeReal?.userDecision}
                  onSubmitDecision={handleDecision}
                />
              </div>
            </aside>
          </div>
        ) : (
          /* Nothing to show: loading, failed, or an empty queue (and why) */
          <div className="flex min-h-0 min-w-0 items-center justify-center bg-field-abyss p-8 xl:col-span-2">
            <EmptyState
              title={centreMessage.title}
              reason={centreMessage.reason}
              honestNote={
                emptyMode === "no-assignments"
                  ? "Independent verifiers only audit assigned workloads. Platform administrators assign audit lanes."
                  : emptyMode === "not-a-verifier"
                  ? "Project owners submit evidence and funders read verified outcomes. Neither reviews."
                  : undefined
              }
              action={
                source.kind === "error"
                  ? source.signedOut
                    ? { label: "Sign in", onClick: () => router.push("/sign-in?next=%2Flab") }
                    : { label: "Try again", onClick: reload }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Keyboard shortcuts */}
      {isShortcutsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center bg-field-abyss/80 p-4"
          onClick={() => setIsShortcutsOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md select-none rounded-lg border border-field-hairline bg-field-canopy p-6 text-[13px] leading-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-medium text-field-text">
                <Keyboard className="size-4 text-field-muted" aria-hidden="true" /> Keyboard shortcuts
              </h2>
              <button
                type="button"
                aria-label="Close shortcuts"
                onClick={() => setIsShortcutsOpen(false)}
                className="flex size-8 items-center justify-center rounded-sm text-field-muted transition-colors duration-[120ms] hover:bg-field-raised hover:text-field-text"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <dl className="space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <dt className="text-field-muted">{s.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="rounded-sm border border-field-hairline bg-field-raised px-2 font-mono text-xs leading-5 text-field-text">
                        {k}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 text-field-muted">Every shortcut has a visible control on the screen.</p>
          </div>
        </div>
      )}
    </div>
  );
}
