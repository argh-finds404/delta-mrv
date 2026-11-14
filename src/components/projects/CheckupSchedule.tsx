"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

const CHOICES = [3, 6, 12, 24] as const;

/**
 * The survival check-up promise. Before anything is approved it may be anything; after, only set
 * or shortened, which the service enforces too: removing it would hide an overdue site.
 */
export function CheckupSchedule({ months, committed, canChange, action }: { months: number | null; committed: boolean; canChange: boolean; action: (months: number | null) => Promise<{ ok: true } | { ok: false; error: string }> }) {
  const router = useRouter();
  const [value, setValue] = React.useState<string>(months === null ? "" : String(months));
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const locked = committed && months !== null;
  const options = locked ? CHOICES.filter((c) => c <= months!) : CHOICES;
  const current = months === null ? "" : String(months);

  if (!canChange) {
    return <p className="text-[15px] text-field-muted">{months ? `Every ${months} months.` : "No check-ups promised."} An owner or administrator of your organisation can change this.</p>;
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          setSaved(false);
          const res = await action(value === "" ? null : Number(value)).catch(() => ({ ok: false as const, error: "The schedule could not be saved. Try again." }));
          if (res.ok) {
            setSaved(true);
            router.refresh();
          } else setError(res.error);
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1.5 text-[14px] font-medium">
          Photograph each approved spot again
          <select
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className="block h-11 w-56 rounded-xl border border-field-hairline bg-white px-3 text-[15px] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
          >
            {!locked && <option value="">Never: no check-ups</option>}
            {options.map((c) => (
              <option key={c} value={c}>
                Every {c} months
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || value === current}
          className="inline-flex h-11 items-center rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-45"
        >
          {pending ? "Saving…" : "Save the schedule"}
        </button>
        {saved && !pending && (
          <span role="status" className="inline-flex items-center gap-1.5 pb-3 text-[14px] text-verified">
            <CheckCircle2 className="size-4" aria-hidden /> Saved
          </span>
        )}
      </div>
      <p className="max-w-[62ch] text-[14px] leading-[1.6] text-field-muted">
        {locked
          ? `Records here are approved under check-ups every ${months} months. The interval can be shortened, never lengthened or removed: the public page would otherwise hide a missed visit.`
          : "Shown on the public page beside each approved record, with the date the next visit is due. A missed visit is shown as missed. Once a record is approved, the interval can only be shortened."}
      </p>
      {error && (
        <p role="alert" className="text-[14px] text-fraud">
          {error}
        </p>
      )}
    </form>
  );
}
