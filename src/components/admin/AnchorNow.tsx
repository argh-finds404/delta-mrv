"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Anchor } from "lucide-react";

type Result = { ok: boolean; message: string };

/** The "Anchor now" button and what the run reported. The action is the page's; the service decides who may. */
export function AnchorNow({ action, disabled, disabledReason }: { action: () => Promise<Result>; disabled?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<Result | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            try {
              setResult(await action());
            } catch {
              setResult({ ok: false, message: "The run did not finish. Nothing was lost: batches already written are picked up by the next run." });
            }
            router.refresh();
          })
        }
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-not-allowed disabled:opacity-55"
      >
        <Anchor className="size-[18px]" aria-hidden />
        {pending ? "Anchoring…" : "Anchor now"}
      </button>
      {disabled && disabledReason && <p className="max-w-[60ch] text-[14px] text-field-muted">{disabledReason}</p>}
      <p role="status" data-testid="anchor-result" data-ok={result ? String(result.ok) : undefined} className="max-w-[70ch] text-[15px] leading-[1.6]">
        {result?.message}
      </p>
    </div>
  );
}
