import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Hourglass } from "lucide-react";
import { cn } from "@/src/lib/utils";

// The shape of checkups.service's SurvivalRecord, repeated here: components do not import server code.
type CheckupState = "none" | "scheduled" | "due" | "overdue" | "in-review";
type SurvivalRecord = {
  recordId: string;
  approvedAt: Date;
  visits: { submissionId: string; submittedAt: Date; approvedAt: Date | null }[];
  lastEvidenceAt: Date;
  nextDueAt: Date | null;
  state: CheckupState;
};

const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const months = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / (30.44 * 86_400_000)));

/** What each state says, with an icon, so no state is told by colour alone. */
function stateLine(r: SurvivalRecord, every: number | null): { Icon: typeof Clock; tone: string; text: string } {
  const due = r.nextDueAt ? date(r.nextDueAt) : "";
  const map: Record<CheckupState, { Icon: typeof Clock; tone: string; text: string }> = {
    none: { Icon: Clock, tone: "text-paper-muted", text: "No check-ups were promised for this site, so none are expected." },
    scheduled: { Icon: Clock, tone: "text-paper-muted", text: `Next check-up due by ${due}, every ${every} months.` },
    due: { Icon: CalendarClock, tone: "text-review", text: `A check-up is due by ${due}.` },
    overdue: { Icon: AlertTriangle, tone: "text-review", text: `Overdue since ${due}: no approved photo of this spot since ${date(r.lastEvidenceAt)}. No evidence is not evidence of survival.` },
    "in-review": { Icon: Hourglass, tone: "text-paper-chain", text: "A check-up has been sent and is with the independent reviewers." },
  };
  return map[r.state];
}

const STATE_WORD: Record<CheckupState, string> = { none: "No schedule", scheduled: "On schedule", due: "Due", overdue: "Overdue", "in-review": "Check-up in review" };
const STATE_ICON: Record<CheckupState, { Icon: typeof Clock; tone: string }> = {
  none: { Icon: Clock, tone: "text-paper-muted" },
  scheduled: { Icon: CheckCircle2, tone: "text-paper-seal" },
  due: { Icon: CalendarClock, tone: "text-review" },
  overdue: { Icon: AlertTriangle, tone: "text-review" },
  "in-review": { Icon: Hourglass, tone: "text-paper-chain" },
};
const short = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Many records at once, for a project page: one row each, the record, its approved check-ups,
 * when the next is due and where it stands. Each row opens the record's own proof page, which
 * holds the full timeline.
 */
export function SurvivalTable({ records }: { records: SurvivalRecord[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-paper-rule bg-paper-card" data-testid="survival-table">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 border-b border-paper-rule px-5 py-2.5 text-[13px] text-paper-muted sm:grid">
        <span>Record</span>
        <span>Check-ups approved</span>
        <span>Next due</span>
        <span>Where it stands</span>
      </div>
      <ul className="divide-y divide-paper-rule">
        {records.map((r) => {
          const { Icon, tone } = STATE_ICON[r.state];
          const approvedVisits = r.visits.filter((v) => v.approvedAt).length;
          return (
            <li key={r.recordId} className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 text-[14px] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center" data-state={r.state}>
              <Link href={`/proof/${r.recordId}`} className="col-span-2 font-medium underline decoration-paper-rule underline-offset-4 hover:decoration-paper-ink sm:col-span-1">
                Approved {short(r.approvedAt)}
              </Link>
              <span className="tabular-nums text-paper-muted">
                <span className="sm:hidden">Check-ups: </span>
                {approvedVisits}
              </span>
              <span className="tabular-nums text-paper-muted">
                <span className="sm:hidden">Next: </span>
                {r.nextDueAt ? short(r.nextDueAt) : "None promised"}
              </span>
              <span className={cn("col-span-2 inline-flex items-center gap-1.5 font-medium sm:col-span-1", tone)}>
                <Icon className="size-4 shrink-0" aria-hidden />
                {STATE_WORD[r.state]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A record's survival history on paper: when it was approved, each time the spot was photographed
 * again and approved, and when the next visit is due. `currentId` marks the record this page is about.
 */
export function SurvivalTimeline({ record, checkupMonths, currentId, showPending = false }: { record: SurvivalRecord; checkupMonths: number | null; currentId?: string; showPending?: boolean }) {
  const line = stateLine(record, checkupMonths);
  const visits = record.visits.filter((v) => showPending || v.approvedAt);
  return (
    <div className="space-y-4" data-testid="survival-timeline" data-state={record.state}>
      <p className={cn("flex items-start gap-2 text-[15px] leading-[1.6]", line.tone)}>
        <line.Icon className="mt-1 size-4 shrink-0" aria-hidden />
        <span>{line.text}</span>
      </p>
      <ol className="relative space-y-0 border-l border-paper-rule pl-5">
        <li className="relative pb-4">
          <span aria-hidden className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-paper-seal bg-paper-seal" />
          <p className="text-[15px]">
            {currentId === record.recordId ? <span className="font-medium">This record</span> : <Link href={`/proof/${record.recordId}`} className="font-medium underline decoration-paper-rule underline-offset-4 hover:decoration-paper-ink">The original record</Link>}{" "}
            <span className="text-paper-muted">approved {date(record.approvedAt)}</span>
          </p>
        </li>
        {visits.map((v, i) => (
          <li key={v.submissionId} className="relative pb-4">
            <span aria-hidden className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2", v.approvedAt ? "border-paper-seal bg-paper" : "border-paper-chain bg-paper")} />
            <p className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
              {v.approvedAt ? (
                <>
                  <CheckCircle2 className="size-3.5 translate-y-0.5 text-paper-seal" aria-hidden />
                  {currentId === v.submissionId ? (
                    <span className="font-medium">This check-up</span>
                  ) : (
                    <Link href={`/proof/${v.submissionId}`} className="font-medium underline decoration-paper-rule underline-offset-4 hover:decoration-paper-ink">
                      Check-up {i + 1}
                    </Link>
                  )}
                  <span className="text-paper-muted">
                    approved {date(v.approvedAt)}, {months(record.approvedAt, v.approvedAt)} months after the record
                  </span>
                </>
              ) : (
                <>
                  <Hourglass className="size-3.5 translate-y-0.5 text-paper-chain" aria-hidden />
                  <span className="font-medium">Check-up {i + 1}</span>
                  <span className="text-paper-muted">sent {date(v.submittedAt)}, in review</span>
                </>
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
