"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** An operator chooses which independent verifier organisation reviews a project. The service decides whether they may. */
export function AssignReviewer({
  projectId,
  verifiers,
  action,
}: {
  projectId: string;
  verifiers: { id: string; name: string }[];
  action: (projectId: string, verifierOrgId: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [choice, setChoice] = React.useState("");
  const [refusal, setRefusal] = React.useState<string | null>(null);
  if (!verifiers.length) return <span className="text-[13px] text-field-muted">No verifier organisation is registered yet.</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {refusal && <span className="w-full text-[13px] text-fraud">{refusal}</span>}
      <select
        aria-label="Verifier organisation"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="h-10 max-w-[240px] rounded-xl border border-field-hairline bg-white px-3 text-[14px] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
      >
        <option value="">Choose a reviewer…</option>
        {verifiers.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || !choice}
        onClick={() =>
          start(async () => {
            const res = await action(projectId, choice);
            setRefusal(res.ok ? null : res.message);
            if (res.ok) router.refresh();
          })
        }
        className="inline-flex h-10 items-center rounded-xl border border-field-hairline px-3.5 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
      >
        {pending ? "Assigning…" : "Assign"}
      </button>
    </div>
  );
}
