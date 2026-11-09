import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

const TONE = {
  neutral: "bg-paper-ink",
  seal: "bg-paper-seal",
  chain: "bg-paper-chain",
  fraud: "bg-[#B4432F]",
} as const;

export type SceneCardRow = { label: string; value: ReactNode; mono?: boolean; tone?: keyof typeof TONE };

/** The small data card that rises over a hero scene. Illustrative values, labelled as such by the frame. */
export function SceneCard({ title, tone = "neutral", note, rows }: { title: string; tone?: keyof typeof TONE; note?: string; rows: SceneCardRow[] }) {
  return (
    <div className="rounded-lg border border-paper-rule bg-paper-card p-3 text-[12px] leading-[1.45] text-paper-ink">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE[tone])} />
        {title}
      </p>
      {note && <p className="mt-1 text-paper-muted">{note}</p>}
      <dl className="mt-2 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-paper-muted">{r.label}</dt>
            <dd className={cn("flex items-center gap-1.5 text-right", r.mono && "font-mono tabular-nums")}>
              {r.tone && <span aria-hidden className={cn("size-1.5 rounded-full", TONE[r.tone])} />}
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
