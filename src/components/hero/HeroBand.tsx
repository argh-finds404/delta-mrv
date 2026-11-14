"use client";

import * as React from "react";
import { preload } from "react-dom";
import { Pause, Play } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { DrawnWatercolor, heroArtFiles } from "./DrawnWatercolor";
import { HERO_SCENES, type HeroScene } from "./scenes";

const STEP_DURATION_MS = 9500;

/** One scene: the painting and its plot drift together; the card and the label float above. */
function SceneLayer({ scene, paused, exiting, onGone }: { scene: HeroScene; paused: boolean; exiting?: boolean; onGone?: () => void }) {
  return (
    <div
      className="hero-layer"
      data-exiting={exiting || undefined}
      aria-hidden={exiting || undefined}
      onTransitionEnd={(e) => {
        if (exiting && e.target === e.currentTarget && e.propertyName === "opacity") onGone?.();
      }}
    >
      <div className="hero-drift" style={{ transformOrigin: scene.origin }}>
        {/* ink, then the colour washing in (our shader; art from scripts/render-hero-from-art.ts) */}
        <DrawnWatercolor art={scene.art} alt={exiting ? "" : scene.alt} meta={scene.meta} paused={paused} />
        <div className="hda-ui" aria-hidden="true">
          {scene.marks}
        </div>
      </div>
      <div className="hda-ui" aria-hidden="true">
        {scene.card}
      </div>
      <p aria-hidden className="hero-caption absolute -top-4 left-[9%] hidden whitespace-pre font-mono text-[11px] text-paper-muted sm:block">
        {scene.readout}
      </p>
    </div>
  );
}

export function HeroBand() {
  const scenes = HERO_SCENES;
  // `gen` keys each showing of a scene, so the one leaving keeps its canvas while it dissolves.
  const [show, setShow] = React.useState<{ active: number; gen: number; prev: { index: number; gen: number } | null }>({ active: 0, gen: 0, prev: null });
  const [paused, setPaused] = React.useState(false);
  const [onScreen, setOnScreen] = React.useState(true);
  const rootRef = React.useRef<HTMLElement>(null);
  const { active, gen, prev } = show;

  const go = (to: (current: number) => number) =>
    setShow((s) => {
      const next = to(s.active);
      return next === s.active ? s : { active: next, gen: s.gen + 1, prev: { index: s.active, gen: s.gen } };
    });

  // the first scene's files load with the page; each next scene's while the one before it plays,
  // so a visitor who leaves early never downloads the paintings they would not have seen
  for (const href of heroArtFiles(scenes[0]!.art)) preload(href, { as: "image" });
  React.useEffect(() => {
    const next = scenes[(active + 1) % scenes.length]!;
    const t = setTimeout(() => {
      for (const href of heroArtFiles(next.art)) new Image().src = href;
    }, 3000);
    return () => clearTimeout(t);
  }, [scenes, active]);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(Boolean(e?.isIntersecting)), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = !paused && onScreen;
  const scene = scenes[active] ?? scenes[0]!;
  const leaving = prev ? scenes[prev.index] : undefined;

  return (
    <div className="contents">
      <div className="hero-band relative z-10 order-last space-y-4 lg:order-none lg:col-start-1 lg:row-start-2 lg:self-start" data-running={running || undefined}>
        <div className="flex items-start gap-4">
          <div role="tablist" aria-label="How Delta checks a claim" className="grid flex-1 grid-cols-4 gap-3">
            {scenes.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={s.label}
                  role="tab"
                  type="button"
                  id={`hero-tab-${i}`}
                  aria-selected={isActive}
                  aria-controls="hero-panel"
                  onClick={() => go(() => i)}
                  className="group space-y-2 rounded-sm pt-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper-ink"
                >
                  <span className="relative block h-0.5 overflow-hidden rounded-full bg-paper-rule">
                    {isActive ? (
                      <span
                        key={gen}
                        className="hero-progress absolute inset-0 origin-left"
                        style={{
                          backgroundColor: s.washColor,
                          animation: running ? `hero-progress ${STEP_DURATION_MS}ms linear forwards` : "none",
                        }}
                        onAnimationEnd={(e) => {
                          if (e.animationName === "hero-progress") go((a) => (a + 1) % scenes.length);
                        }}
                      />
                    ) : (
                      i < active && <span className="absolute inset-0 bg-paper-ink/40" />
                    )}
                  </span>
                  <span className={cn("block text-[13px] font-medium transition-colors", isActive ? "text-paper-ink" : "text-paper-muted group-hover:text-paper-ink")}>{s.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play the scenes" : "Pause the scenes"}
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-paper-rule text-paper-ink transition-colors hover:border-paper-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink motion-reduce:hidden"
          >
            {paused ? <Play className="size-3.5 fill-current" aria-hidden /> : <Pause className="size-3.5 fill-current" aria-hidden />}
          </button>
        </div>

        <p
          key={gen}
          id="hero-panel"
          role="tabpanel"
          aria-labelledby={`hero-tab-${active}`}
          className="hero-caption min-h-[3.2em] max-w-[52ch] text-[17px] leading-[1.6] text-paper-muted"
          style={{ "--wash": `${scene.washColor}38` } as React.CSSProperties}
          data-paused={paused || undefined}
        >
          {scene.caption}
        </p>
        <p className="text-[12px] text-paper-muted">
          The paintings are illustrations of delta landscapes, not maps of the demo sites. The plots and readings are examples of what Delta records.
        </p>
      </div>

      <figure
        ref={rootRef}
        className="hero-art relative -mx-6 sm:mx-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
        data-paused={paused || undefined}
      >
        {/* the scene before this one dissolves into the paper while the new one is drawn beneath it */}
        {prev && leaving && <SceneLayer key={prev.gen} scene={leaving} paused exiting onGone={() => setShow((s) => (s.prev?.gen === prev.gen ? { ...s, prev: null } : s))} />}
        <SceneLayer key={gen} scene={scene} paused={paused} />
        <noscript>
          <style>{".dw-fig img{opacity:1!important}"}</style>
        </noscript>
      </figure>
    </div>
  );
}
