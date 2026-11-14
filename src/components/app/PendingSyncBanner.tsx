"use client";

import * as React from "react";
import Link from "next/link";
import { CloudUpload } from "lucide-react";
import { listOfflineDrafts } from "@/src/components/submit/offline-vault";

/**
 * Submissions saved on this device while offline and not sent yet (the field vault, IndexedDB).
 * They exist nowhere else, so the overview says so and links to each project's form, which can
 * restore them. Only the caller's own projects: the vault is cleared at sign-out.
 */
export function PendingSyncBanner({ projects }: { projects: { id: string; title: string }[] }) {
  const [waiting, setWaiting] = React.useState<{ id: string; title: string; count: number }[]>([]);

  React.useEffect(() => {
    let ignore = false;
    void listOfflineDrafts()
      .then((drafts) => {
        if (ignore) return;
        setWaiting(
          projects
            .map((p) => ({ ...p, count: drafts.filter((d) => d.projectId === p.id).length }))
            .filter((p) => p.count > 0),
        );
      })
      .catch(() => {}); // no IndexedDB here: nothing can be waiting on this device
    return () => {
      ignore = true;
    };
  }, [projects]);

  const total = waiting.reduce((n, p) => n + p.count, 0);
  if (!total) return null;
  return (
    <section role="status" className="rise-in flex flex-wrap items-start gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--review)_35%,transparent)] bg-[color-mix(in_srgb,var(--review)_8%,white)] p-5">
      <CloudUpload className="mt-0.5 size-5 shrink-0 text-review" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[15px] font-medium">
          {total} {total === 1 ? "submission is" : "submissions are"} saved on this device and not sent yet
        </p>
        <p className="text-[14px] leading-[1.6] text-field-muted">They were kept while you were offline and exist only here. Open the form to restore and send them.</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
          {waiting.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}/submit?drafts=1`} className="font-medium text-signal underline underline-offset-4">
                {p.title} ({p.count})
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
