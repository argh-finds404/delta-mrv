"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const when = (d: Date | string) => `${new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;

/** The owner's "ask for a reviewer". It assigns nothing: an operator chooses the reviewer. The service decides who may ask. */
export function RequestReviewer({ requestedAt, canAsk, action }: { requestedAt: Date | null; canAsk: boolean; action: () => Promise<{ ok: true } | { ok: false; error: string }> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (requestedAt) {
    return (
      <p className="text-[14px] leading-[1.6] text-field-muted" data-testid="reviewer-requested">
        You asked for a reviewer on {when(requestedAt)}. A Delta operator assigns an independent organisation; you will see it here.
      </p>
    );
  }
  if (!canAsk) return <p className="text-[14px] text-field-muted">An owner or administrator of your organisation can ask for a reviewer.</p>;
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await action().catch(() => ({ ok: false as const, error: "The request could not be sent. Try again." }));
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
        className="inline-flex h-11 items-center rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
      >
        {pending ? "Asking…" : "Ask for an independent reviewer"}
      </button>
      {error && (
        <p role="alert" className="text-[14px] text-fraud">
          {error}
        </p>
      )}
    </div>
  );
}
