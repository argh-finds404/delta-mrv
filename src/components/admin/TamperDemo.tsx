"use client";

import * as React from "react";

type Verdict = { ok: boolean; firstBadSeq: number | null; reason: string | null };
type Demo = { orgName: string; events: number; tamperedSeq: number; eventType: string; before: Verdict; after: Verdict };
type Result = { ok: true; demo: Demo } | { ok: false; message: string };

const say = (v: Verdict) => (v.ok ? "Verifies from the first event to the last." : `Fails at event ${v.firstBadSeq}: ${v.reason}.`);

/** Changes one event in a copy of a real audit chain and shows verification finding exactly that event. */
export function TamperDemo({ action }: { action: () => Promise<Result> }) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<Result | null>(null);
  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await action()))}
        className="inline-flex h-10 items-center rounded-xl border border-field-hairline px-3.5 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
      >
        {pending ? "Editing a copy…" : "Change one event in a copy"}
      </button>
      {result && !result.ok && <p className="text-[14px] text-field-muted">{result.message}</p>}
      {result?.ok && (
        <dl data-testid="tamper-result" className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 rounded-2xl border border-field-hairline bg-field-canopy p-4">
            <dt className="text-[13px] text-field-muted">
              The stored chain of {result.demo.orgName}, {result.demo.events} events
            </dt>
            <dd className="text-[15px]">{say(result.demo.before)}</dd>
          </div>
          <div className="space-y-1 rounded-2xl border border-fraud/40 bg-field-canopy p-4">
            <dt className="text-[13px] text-field-muted">
              The same chain with event {result.demo.tamperedSeq} ({result.demo.eventType.replaceAll("_", " ").toLowerCase()}) edited
            </dt>
            <dd className="text-[15px] text-fraud">{say(result.demo.after)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
