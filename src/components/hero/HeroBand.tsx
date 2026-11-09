"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { HERO_SCENES } from "./scenes";

export type HeroScene = {
  /** Tab label, e.g. "Capture". */
  label: string;
  /** One sentence under the tabs; a <mark className="brush"> inside it is swept in. */
  caption: React.ReactNode;
  /** The photograph and its annotation layer (SceneImage). */
  art: React.ReactNode;
  /** The data card that rises over the art. */
  card: React.ReactNode;
  /** Card position over the art, in percent of the frame. */
  cardAt: { left: string; top: string };
  /** What the photograph shows, under the frame. */
  picture: string;
};

/**
 * Felt's hero band: scenes that sketch in, take colour, pop their markers and raise a card, then
 * hand over. The progress bar under the active tab is a CSS animation; when it ends, the next
 * scene starts. With reduced motion there is no progress animation, so nothing advances on its
 * own and every scene is a still (WCAG 2.2.2). A pause control stops it at any time, and it
 * pauses while scrolled out of view.

 */
export function HeroBand() {
  const scenes = HERO_SCENES;
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [onScreen, setOnScreen] = React.useState(true);
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(Boolean(e?.isIntersecting)), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = !paused && onScreen;
  const scene = scenes[active]!;

  return (
    <div className="contents">
      {/* the band: tabs with progress, and the caption they control */}
      <div className="hero-band order-last space-y-4 lg:order-none lg:col-start-1 lg:row-start-2 lg:self-start" data-running={running || undefined}>
        <div className="flex items-start gap-4">
          <div role="tablist" aria-label="How Delta checks a claim" className="grid flex-1 grid-cols-4 gap-3">
            {scenes.map((s, i) => (
              <button
                key={s.label}
                role="tab"
                type="button"
                id={`hero-tab-${i}`}
                aria-selected={i === active}
                aria-controls="hero-panel"
                onClick={() => setActive(i)}
                className="group space-y-2 rounded-sm pt-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper-ink"
              >
                <span className="relative block h-0.5 overflow-hidden rounded-full bg-paper-rule">
                  {i === active ? (
                    <span
                      key={active}
                      className="hero-progress absolute inset-0 origin-left bg-paper-ink"
                      onAnimationEnd={(e) => {
                        if (e.animationName === "hero-progress") setActive((a) => (a + 1) % scenes.length);
                      }}
                    />
                  ) : (
                    i < active && <span className="absolute inset-0 bg-paper-ink/40" />
                  )}
                </span>
                <span className={cn("block text-[13px] transition-colors", i === active ? "text-paper-ink" : "text-paper-muted group-hover:text-paper-ink")}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play the scenes" : "Pause the scenes"}
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-paper-rule text-paper-ink transition-colors hover:border-paper-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink motion-reduce:hidden"
          >
            {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
          </button>
        </div>
        <p key={active} id="hero-panel" role="tabpanel" aria-labelledby={`hero-tab-${active}`} className="hero-caption min-h-[3.2em] max-w-[52ch] text-[17px] leading-[1.6] text-paper-muted">
          {scene.caption}
        </p>
      </div>

      {/* the photograph: every scene stacked, only the active one shown */}
      {/* the plate bleeds toward the page edge and dissolves into the paper, as felt.com's art does */}
      <figure ref={root} className="-mx-6 space-y-3 sm:mx-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:-mr-12 lg:self-center xl:-mr-20">
        <div className="relative aspect-[10/7]">
          {scenes.map((s, i) => (
            <div key={s.label} className="hero-scene absolute inset-0" data-active={i === active || undefined} aria-hidden={i !== active}>
              {s.art}
              {/* placed per scene from 640px up; on a phone it docks in a corner so it never leaves the frame */}
              <div
                className="hero-card absolute bottom-3 right-3 w-[200px] sm:bottom-auto sm:right-auto sm:left-(--card-left) sm:top-(--card-top) sm:w-[min(250px,40%)]"
                style={{ "--card-left": s.cardAt.left, "--card-top": s.cardAt.top } as React.CSSProperties}
              >
                {s.card}
              </div>
            </div>
          ))}
        </div>
        <figcaption key={active} className="hero-caption px-6 text-[13px] text-paper-muted sm:px-0">
          {scene.picture} The annotations illustrate what Delta records.
        </figcaption>
      </figure>
    </div>
  );
}
