"use client";

import * as React from "react";

type Side = { fileId: string; role: string; submissionId: string; status: string; projectTitle: string; ownerOrgName: string };
type Lookup = {
  matchRef: string;
  flagged: (Side & { findingId: string; kind: string; distance: number | null })[];
  matched: Side | null;
  resolutions: { outcome: "CONFIRMED" | "CLEARED"; reason: string; at: Date | string; by: string }[];
};

const field = "w-full rounded-xl border border-field-hairline bg-white px-3 text-[15px] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20";
const quiet =
  "inline-flex h-10 items-center rounded-xl border border-field-hairline px-3.5 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55";
const OUTCOME = { CONFIRMED: "Confirmed as a reuse", CLEARED: "Cleared: not a reuse" } as const;
const ROLE = { BEFORE: "before photo", AFTER: "after photo", SUPPLEMENT: "supplementary photo" } as Record<string, string>;
const when = (d: Date | string) => `${new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;

function SideRow({ label, side, extra }: { label: string; side: Side; extra?: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[13px] text-field-muted">{label}</dt>
      <dd className="text-[15px]">
        <span className="font-medium">{side.projectTitle}</span> · {side.ownerOrgName}
        <span className="block text-[13px] text-field-muted">
          The {ROLE[side.role] ?? "photo"} of submission <span className="font-mono">{side.submissionId.slice(0, 8)}</span>
          {extra ? `, ${extra}` : ""}
        </span>
      </dd>
    </div>
  );
}

/**
 * matchRef resolution on /admin (docs/10-FORENSICS.md §4): look a reference up, see both sides,
 * record a conclusion with a reason. Both calls are server actions; the service checks the caller
 * is an operator and writes the conclusion to the audit chain.
 */
export function MatchResolver({
  lookup,
  resolve,
}: {
  lookup: (ref: string) => Promise<{ ok: true; lookup: Lookup } | { ok: false; message: string }>;
  resolve: (ref: string, outcome: "CONFIRMED" | "CLEARED", reason: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [pending, start] = React.useTransition();
  const [found, setFound] = React.useState<Lookup | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [reason, setReason] = React.useState("");

  const find = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ref = String(new FormData(e.currentTarget).get("ref") ?? "");
    start(async () => {
      setMessage(null);
      const res = await lookup(ref);
      if (res.ok) setFound(res.lookup);
      else {
        setFound(null);
        setMessage({ ok: false, text: res.message });
      }
    });
  };
  const record = (outcome: "CONFIRMED" | "CLEARED") =>
    start(async () => {
      if (!found) return;
      const res = await resolve(found.matchRef, outcome, reason);
      setMessage({ ok: res.ok, text: res.message });
      if (!res.ok) return;
      setReason("");
      const again = await lookup(found.matchRef);
      if (again.ok) setFound(again.lookup);
    });
  const left = Math.max(0, 20 - reason.trim().length);

  return (
    <div className="max-w-[760px] space-y-5">
      <form onSubmit={find} className="flex flex-wrap gap-2">
        <input name="ref" required aria-label="Match reference" placeholder="mr_…" autoComplete="off" spellCheck={false} className={`${field} h-10 max-w-[420px] font-mono text-[14px]`} />
        <button type="submit" disabled={pending} className={quiet}>
          {pending && !found ? "Looking…" : "Look it up"}
        </button>
      </form>

      {found && (
        <div className="space-y-5 rounded-2xl border border-field-hairline bg-field-canopy p-5" data-testid="match-lookup">
          <dl className="space-y-4">
            {found.flagged.map((f) => (
              <SideRow key={f.findingId} label="Flagged" side={f} extra={f.distance === null ? "identical file" : `${f.distance} of 64 bits differ`} />
            ))}
            {found.matched ? (
              <SideRow label="Matches the earlier file of" side={found.matched} />
            ) : (
              <div>
                <dt className="text-[13px] text-field-muted">Matches</dt>
                <dd className="text-[15px]">The earlier file could not be found. It may have been removed with an abandoned draft.</dd>
              </div>
            )}
          </dl>

          {found.resolutions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[15px] font-medium">Recorded so far</h3>
              <ul className="space-y-2 text-[14px]">
                {found.resolutions.map((r, i) => (
                  <li key={i}>
                    <span className="font-medium">{OUTCOME[r.outcome]}</span> <span className="text-field-muted">by {r.by}, {when(r.at)}</span>
                    <span className="block">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 border-t border-field-hairline pt-4">
            <label htmlFor="match-reason" className="block text-[14px] font-medium">
              Your conclusion, and why
            </label>
            <textarea id="match-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} py-2.5 leading-[1.55]`} />
            <p className="text-[13px] text-field-muted">
              {left ? `${left} more ${left === 1 ? "character" : "characters"} needed. ` : ""}The flagged submission&apos;s owner and reviewers read this: do not name the other organisation.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending || left > 0} onClick={() => record("CONFIRMED")} className={quiet}>
                Confirm it is a reuse
              </button>
              <button type="button" disabled={pending || left > 0} onClick={() => record("CLEARED")} className={quiet}>
                Clear it: not a reuse
              </button>
            </div>
          </div>
        </div>
      )}

      <p role="status" className={message?.ok === false ? "text-[14px] text-fraud" : "text-[14px] text-field-muted"}>
        {message?.text}
      </p>
    </div>
  );
}
