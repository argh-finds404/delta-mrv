import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import art from "@/src/components/hero/hero-art.json";
import { Wordmark } from "@/src/components/site/Wordmark";

// The auth panel: the "review" painting floating on the forest ground, its registered plot
// inking in and its two photo pins dropping, the way a site looks to Delta. An illustration,
// captioned as one; no record, number or hash on this panel pretends to be real.

const scene = art.scenes.review;
const VIEW = `0 0 ${art.width} ${art.height}`;
const pathOf = (pts: number[][]) => `M${pts.map((p) => p.join(" ")).join("L")}Z`;

const TRUTHS = [
  "Photos are fingerprinted the moment they are stored.",
  "Two reviewers from another organisation must agree.",
  "Every decision is kept, and none can be edited.",
];

export function AuthArt() {
  return (
    <aside className="auth-ground relative flex flex-col overflow-hidden border-field-hairline md:sticky md:top-0 md:h-dvh md:border-r">
      <div className="relative z-10 px-6 pt-6 md:px-12 md:pt-10">
        <Link href="/" aria-label="Delta, home" className="inline-flex rounded-sm text-field-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">
          <Wordmark />
        </Link>
      </div>

      <figure className="relative mx-auto -mt-2 w-[min(100%,560px)] px-4 md:my-auto md:w-[min(100%,760px)] md:px-6">
        <div className="auth-island relative">
          {/* the painting's own silhouette in paper, under the paint: the washes read as they do on paper */}
          <div className="auth-island-ground absolute inset-0" aria-hidden />
          <Image src="/images/hero/review-colour.webp" alt="" width={art.width} height={art.height} priority sizes="(min-width: 768px) 55vw, 100vw" className="h-auto w-full select-none" draggable={false} />
          <svg viewBox={VIEW} className="absolute inset-0 h-full w-full" aria-hidden>
            {scene.plots.map((pts: number[][], i: number) => (
              <g key={i}>
                <path className="auth-wash" d={pathOf(pts)} fill="#D7F6B8" fillOpacity={0.28} />
                <path className="auth-plot" d={pathOf(pts)} pathLength={1} fill="none" stroke="#D7F6B8" strokeWidth={7} strokeLinejoin="round" />
              </g>
            ))}
            {scene.pins.map((p: number[], i: number) => {
              const x = p[0] ?? 0;
              const y = p[1] ?? 0;
              return (
                <g key={i} transform={`translate(${x} ${y})`}>
                  <g className="auth-pin" style={{ "--i": i } as CSSProperties}>
                    <circle r="30" fill="#101A18" stroke="#D7F6B8" strokeWidth="5" />
                    <rect x="-11" y="-8" width="22" height="16" rx="3" fill="#D7F6B8" />
                    <circle r="4.5" fill="#101A18" />
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
        <figcaption className="sr-only">An illustration of a restoration site with one registered plot and two photo points.</figcaption>
      </figure>

      <div className="relative z-10 hidden space-y-5 px-12 pb-10 md:block">
        <p className="max-w-[22ch] font-serif text-[30px] leading-[1.1] tracking-[-0.015em] text-field-text">Evidence a stranger can check.</p>
        <ul className="max-w-[46ch] divide-y divide-field-hairline border-y border-field-hairline">
          {TRUTHS.map((t) => (
            <li key={t} className="py-2.5 text-[15px] leading-[1.5] text-field-muted">
              {t}
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-field-inert">Illustration of a restoration site.</p>
      </div>
    </aside>
  );
}
