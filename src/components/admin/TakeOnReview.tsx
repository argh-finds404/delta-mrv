"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** One project a verifier-organisation admin can take on. The service decides whether they may. */
export function TakeOnReview({ projectId, action }: { projectId: string; action: (projectId: string) => Promise<{ ok: boolean; message: string }> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [refusal, setRefusal] = React.useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {refusal && <span className="text-[13px] text-fraud">{refusal}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await action(projectId);
            setRefusal(res.ok ? null : res.message);
            if (res.ok) router.refresh();
          })
        }
        className="inline-flex h-10 items-center rounded-xl border border-field-hairline px-3.5 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
      >
        {pending ? "Recording…" : "Take on for review"}
      </button>
    </div>
  );
}
