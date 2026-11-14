"use client";

import * as React from "react";
import Image from "next/image";
import { Grid3x3 } from "lucide-react";
import { cn } from "@/src/lib/utils";

const STOPS = [
  { label: "Earlier", value: 0 },
  { label: "Both", value: 50 },
  { label: "Today", value: 100 },
] as const;

/**
 * The "ghost": today's photo laid over the earlier one, faded by a slider, with a thirds grid, so
 * the field team sees before sending whether the two were taken from the same spot. Photos taken
 * with the phone's own camera keep their EXIF time and position, which an in-page camera would
 * strip; the guide is checked against the photo afterwards rather than over a live viewfinder.
 */
export function FramingCheck({ reference, candidate, referenceLabel, candidateLabel }: { reference: string; candidate: string; referenceLabel: string; candidateLabel: string }) {
  const [mix, setMix] = React.useState(50);
  const [grid, setGrid] = React.useState(true);
  const id = React.useId();
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-11 items-center rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal sm:h-8",
      active ? "bg-field-text text-field-abyss" : "text-field-muted hover:text-field-text",
    );

  return (
    <figure className="space-y-3 rounded-xl border border-field-hairline bg-field-canopy p-4" data-testid="framing-check">
      <figcaption className="space-y-1">
        <span className="block text-[14px] font-medium text-field-text">Check the framing</span>
        <span className="block text-[13px] leading-[1.55] text-field-muted">
          Slide between the two. The horizon, the water&apos;s edge and any post or tree should sit in the same place. If they do not, take the photo again from where the earlier one was taken.
        </span>
      </figcaption>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-field-stage">
        <Image src={reference} alt={referenceLabel} fill unoptimized sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
        <Image src={candidate} alt={candidateLabel} fill unoptimized sizes="(min-width: 768px) 720px, 100vw" className="object-cover" style={{ opacity: mix / 100 }} />
        {grid && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, transparent calc(33.333% - 0.5px), rgb(255 255 255 / 0.7) calc(33.333% - 0.5px), rgb(255 255 255 / 0.7) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgb(255 255 255 / 0.7) calc(66.666% - 0.5px), rgb(255 255 255 / 0.7) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px)), linear-gradient(to bottom, transparent calc(33.333% - 0.5px), rgb(255 255 255 / 0.7) calc(33.333% - 0.5px), rgb(255 255 255 / 0.7) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgb(255 255 255 / 0.7) calc(66.666% - 0.5px), rgb(255 255 255 / 0.7) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px))",
            }}
          />
        )}
        <span aria-hidden className="absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[12px] font-medium text-white" style={{ opacity: 1 - mix / 140 }}>
          Earlier
        </span>
        <span aria-hidden className="absolute right-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[12px] font-medium text-white" style={{ opacity: 0.3 + mix / 140 }}>
          Today
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Show" className="flex items-center rounded-lg border border-field-hairline bg-field-raised p-0.5">
          {STOPS.map((s) => (
            <button key={s.label} type="button" aria-pressed={mix === s.value} onClick={() => setMix(s.value)} className={chip(mix === s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <label htmlFor={id} className="sr-only">
          Blend between the earlier photo and today&apos;s
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={5}
          value={mix}
          onChange={(e) => setMix(Number(e.target.value))}
          aria-valuetext={mix === 0 ? "Earlier photo only" : mix === 100 ? "Today's photo only" : `${mix}% today's photo`}
          className="h-11 min-w-[160px] flex-1 accent-[var(--signal)]"
        />
        <button type="button" aria-pressed={grid} onClick={() => setGrid((g) => !g)} className={cn("inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-signal sm:h-8", grid ? "border-field-muted text-field-text" : "border-field-hairline text-field-muted")}>
          <Grid3x3 className="size-4" aria-hidden />
          Grid
        </button>
      </div>
    </figure>
  );
}
