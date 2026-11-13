"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImageOff, Keyboard, ListChecks, ShieldCheck, UserCheck, X } from "lucide-react";
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
import { sampleLabSubmissions, type LabFinding, type LabSubmission } from "@/src/components/lab/fixtures";
import { SEVERITY_ORDER, toLabFinding, type ApiFinding } from "@/src/components/lab/to-lab-finding";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { EmptyState } from "@/src/components/empty-state/empty-state";
import { cn } from "@/src/lib/utils";

const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Open or close the queue", keys: ["q"] },
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
  files: LabFile[];
};

/** An evidence file as the queue reports it: what the stored file says about itself, nothing inferred. */
type LabFile = { id: string; role: "BEFORE" | "AFTER" | "SUPPLEMENT"; round: number; sha256: string; capturedAt: string | null; gps: { coordinates: [number, number] } | null };
const toImage = (f: LabFile) => ({
  url: `/api/evidence/${f.id}`,
  sha256: f.sha256,
  capturedAt: f.capturedAt,
  gps: f.gps ? { lat: f.gps.coordinates[1], lng: f.gps.coordinates[0] } : undefined,
});

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
    files: LabFile[];
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

export function LabWorkspace() {
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
  const [queueOpen, setQueueOpen] = React.useState<boolean>(false);

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
        // /lab?s=<id> opens one submission, wherever it sits in the queue
        const focus = new URLSearchParams(window.location.search).get("s");
        const res = await fetch(`/api/lab/queue${focus ? `?s=${encodeURIComponent(focus)}` : ""}`, { cache: "no-store" });
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
        setSelectedId((cur) => (mapped.some((i) => i.id === cur) ? cur : focus && mapped.some((i) => i.id === focus) ? focus : (mapped[0]?.id ?? "")));
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

  // The selected real submission's findings, as stored (GET /api/submissions/[id]/findings)
  const itemsRef = React.useRef(items); // read inside the fetch, without re-fetching when the queue reloads
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [realFindings, setRealFindings] = React.useState<{ id: string; state: "loading" | "error" | LabFinding[] } | null>(null);
  React.useEffect(() => {
    if (source.kind !== "real" || !selectedId) return;
    let ignore = false;
    void (async () => {
      await Promise.resolve();
      if (ignore) return;
      setRealFindings({ id: selectedId, state: "loading" });
      try {
        const res = await fetch(`/api/submissions/${selectedId}/findings`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { findings: ApiFinding[] };
        if (!ignore) setRealFindings({ id: selectedId, state: data.findings.map((f) => toLabFinding(f, itemsRef.current.find((i) => i.id === selectedId)?.files)) });
      } catch {
        if (!ignore) setRealFindings({ id: selectedId, state: "error" });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [source.kind, selectedId, reloadKey]);

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
        if (isShortcutsOpen || queueOpen) {
          e.preventDefault();
          setIsShortcutsOpen(false);
          setQueueOpen(false);
        }
      } else if (e.key === "q") {
        e.preventDefault();
        setQueueOpen((open) => !open);
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
  }, [list, selectedId, isShortcutsOpen, queueOpen]);

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
    "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-field-hairline bg-field-canopy px-3 text-[14px] text-field-text transition-colors duration-150 hover:bg-field-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-40";
  const position = list.findIndex((s) => s.id === selectedId);
  const step = (by: number) => {
    const next = list[position + by];
    if (next) setSelectedId(next.id);
  };

  const centreMessage = (() => {
    if (source.kind === "loading") return { title: "Loading the review queue", reason: "Fetching the submissions assigned to your organisation." };
    if (source.kind === "error") return { title: source.signedOut ? "Sign in again" : "The queue did not load", reason: source.message };
    if (emptyMode === "no-assignments") return { title: "Your review queue", reason: "Your organisation has not taken on a project yet, so nothing can reach this queue. An administrator of your organisation takes on projects that have no reviewer, on the Anchoring tab." };
    if (emptyMode === "not-a-verifier") return { title: "No review queue", reason: "The Evidence Lab is for verifier organisations. Your organisation does not review submissions, so there is nothing to show here." };
    return { title: "Queue clear", reason: "Nothing is awaiting your review. New submissions appear here automatically once forensic processing completes." };
  })();

  const showDetail = source.kind !== "loading" && source.kind !== "error" && emptyMode === "none" && active !== undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col font-sans text-field-text">
      {/* The Lab's own toolbar: the queue (a drawer, not a sidebar), stepping, and tools */}
      <div className="flex min-h-14 shrink-0 select-none flex-wrap items-center gap-2 border-b border-field-hairline bg-field-canopy/70 px-4 py-2 sm:px-6">
        <button type="button" onClick={() => setQueueOpen(true)} className={headerButton} aria-haspopup="dialog" aria-expanded={queueOpen}>
          <ListChecks className="size-4" aria-hidden="true" />
          Queue
          {source.kind === "real" && <span className="rounded-full bg-signal px-1.5 text-[12px] font-semibold tabular-nums text-white">{total}</span>}
          <kbd className="hidden rounded border border-field-hairline px-1 font-mono text-[11px] text-field-muted sm:inline">q</kbd>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} disabled={position <= 0} aria-label="Previous submission (k)" className={cn(headerButton, "px-2")}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-[72px] text-center text-[13px] tabular-nums text-field-muted">{position >= 0 ? `${position + 1} of ${list.length}` : "—"}</span>
          <button type="button" onClick={() => step(1)} disabled={position < 0 || position >= list.length - 1} aria-label="Next submission (j)" className={cn(headerButton, "px-2")}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
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
            <kbd className="rounded border border-field-hairline px-1 font-mono text-[11px] text-field-muted">?</kbd>
          </button>
        </div>
      </div>

      {/* The queue: a drawer over the page, opened on demand, so the evidence keeps the width */}
      <div className={cn("fixed inset-0 z-50", queueOpen ? "visible" : "invisible delay-300")} inert={!queueOpen}>
        <div
          aria-hidden
          onClick={() => setQueueOpen(false)}
          className={cn("absolute inset-0 bg-field-text/25 transition-opacity duration-300", queueOpen ? "opacity-100" : "opacity-0")}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review queue"
          className={cn(
            "sheet absolute inset-y-0 left-0 flex w-[min(420px,92vw)] flex-col overflow-hidden rounded-r-2xl bg-field-canopy transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            queueOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={() => setQueueOpen(false)}
            aria-label="Close the queue"
            className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-lg text-field-muted transition-colors hover:bg-field-raised hover:text-field-text"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          {source.kind === "loading" || source.kind === "error" ? (
            <p className="px-5 py-4 text-[14px] text-field-muted">{source.kind === "loading" ? "Loading the review queue…" : "No queue loaded."}</p>
          ) : (
            <QueuePane
              className="flex-1 border-r-0"
              submissions={list}
              totalCount={isFixtures ? undefined : total}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setQueueOpen(false);
              }}
              isVerifierAdmin={isVerifierAdmin}
              emptyStateMode={emptyMode}
            />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showDetail && active ? (
          <div key={active.id} className="mx-auto grid max-w-[1440px] gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            {/* Evidence: the comparison is the reviewer's core act, so it takes the width */}
            <main
              aria-label="Evidence"
              className="rise-in lift flex h-[min(78dvh,820px)] min-h-[30rem] min-w-0 flex-col gap-4 rounded-2xl border border-field-hairline bg-field-canopy p-4 sm:p-5"
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
              ) : activeReal && activeReal.files.some((f) => f.role === "BEFORE") && activeReal.files.some((f) => f.role === "AFTER") ? (
                (() => {
                  // the pair belongs to the round it was sent in; a later round adds supplements to it
                  const beforeFile = activeReal.files.findLast((f) => f.role === "BEFORE")!;
                  const afterFile = activeReal.files.findLast((f) => f.role === "AFTER")!;
                  const supplements = activeReal.files.filter((f) => f.role === "SUPPLEMENT");
                  return (
                    <>
                    {supplements.length > 0 && (
                      // the new evidence of a later round: in view, not folded into the details
                      <p className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-field-hairline bg-field-raised px-3 py-2 text-[14px]">
                        <span className="text-field-muted">Sent after more proof was asked for:</span>
                        {supplements.map((f, i) => (
                          <a key={f.id} href={`/api/evidence/${f.id}`} target="_blank" rel="noreferrer" className="font-medium text-signal underline underline-offset-4">
                            Supplementary photo {i + 1}, round {f.round}
                          </a>
                        ))}
                      </p>
                    )}
                    <EvidencePair
                      className="flex-1"
                      before={toImage(beforeFile)}
                      after={toImage(afterFile)}
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
                    </>
                  );
                })()
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-field-hairline bg-field-canopy p-8 text-center">
                  <ImageOff className="size-6 text-field-muted" aria-hidden="true" />
                  <h2 className="text-base font-medium text-field-text">No photographs are stored for this record</h2>
                  <p className="prose-column text-[13px] leading-5 text-field-muted">
                    The record exists, but no before and after photo is stored with it, so there is nothing to compare. A record like this cannot be
                    judged on its evidence.
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

            {/* Findings, then the decision, in one column of cards; the decision card stays in view */}
            <aside aria-label="Findings and decision" className="flex min-w-0 flex-col gap-4">
              <div className="rise-in lift rounded-2xl border border-field-hairline bg-field-canopy p-5" style={{ "--i": 1 } as React.CSSProperties}>
                <div>
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
                  ) : realFindings?.id === active.id && Array.isArray(realFindings.state) && realFindings.state.length > 0 ? (
                    <div className="space-y-2">
                      {realFindings.state
                        .slice()
                        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
                        .map((finding) => (
                          <FindingCard key={finding.id} finding={finding} />
                        ))}
                    </div>
                  ) : realFindings?.id === active.id && realFindings.state === "loading" ? (
                    <p className="text-[13px] text-field-muted">Loading findings…</p>
                  ) : realFindings?.id === active.id && realFindings.state === "error" ? (
                    <p role="alert" className="rounded-lg border border-field-hairline bg-field-raised p-4 text-[13px] text-field-text">
                      The findings could not be loaded. Nothing was changed.
                    </p>
                  ) : (
                    // Say only what is true: an empty list is not the checks having passed.
                    <div className="space-y-1 rounded-lg border border-field-hairline bg-field-raised p-4 text-[13px] leading-5">
                      <p className="text-[15px] leading-[21px] text-field-text">No findings recorded</p>
                      <p className="text-field-muted">No forensic findings are stored for this submission. That is not the same as the checks having passed.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Read-only below 1024px (docs/19 §2) */}
              <p role="note" className="rounded-2xl border border-field-hairline bg-field-canopy p-4 text-[14px] leading-5 text-field-muted lg:hidden">
                Open the review on a larger screen to decide. You can read everything here.
              </p>

              <div className="rise-in lift sticky bottom-4 rounded-2xl border border-field-hairline bg-field-canopy p-5 max-lg:hidden" style={{ "--i": 2 } as React.CSSProperties}>
                {decisionError && (
                  <p
                    role="alert"
                    className="mb-3 max-w-[640px] rounded-sm border border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] px-3 py-2 text-[13px] leading-5 text-fraud"
                  >
                    {decisionError}
                  </p>
                )}
                <DecisionForm
                  className="rounded-none border-0 bg-transparent p-0"
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
          <div className="flex min-h-full min-w-0 items-center justify-center p-8">
            <EmptyState
              title={centreMessage.title}
              reason={centreMessage.reason}
              honestNote={emptyMode === "not-a-verifier" ? "Project owners submit evidence and funders read verified outcomes. Neither reviews." : undefined}
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
