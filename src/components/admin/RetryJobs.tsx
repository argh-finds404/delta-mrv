"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

type Result = { ok: boolean; message: string };

/** "Retry stopped jobs" (docs/01-FEATURE-LOCK.md M6). The action is the page's; the service decides who may. */
export function RetryJobs({ action }: { action: () => Promise<Result> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<Result | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setResult(await action());
            } catch {
              setResult({ ok: false, message: "The retry did not go through. Nothing was changed." });
            }
            router.refresh();
          })
        }
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-field-hairline px-3.5 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
      >
        <RotateCw className="size-4" aria-hidden />
        {pending ? "Retrying…" : "Retry stopped jobs"}
      </button>
      <p role="status" className={result?.ok === false ? "text-[14px] text-fraud" : "text-[14px] text-field-muted"}>
        {result?.message}
      </p>
    </div>
  );
}
