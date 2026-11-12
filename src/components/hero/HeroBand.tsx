"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { DrawnWatercolor } from "./DrawnWatercolor";
import { HERO_SCENES } from "./scenes";

const STEP_DURATION_MS = 8000;

export function HeroBand() {
  const scenes = HERO_SCENES;
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [onScreen, setOnScreen] = React.useState(true);
  const rootRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(Boolean(e?.isIntersecting)), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = !paused && onScreen;
  const scene = scenes[active] ?? scenes[0];

  return (
    <div className="contents">
      {/* Left Column, Row 2: Tabs with progress bar and active caption */}
      <div
        className="hero-band order-last space-y-4 lg:order-none lg:col-start-1 lg:row-start-2 lg:self-start"
        data-running={running || undefined}
      >
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
                  onClick={() => setActive(i)}
                  className="group space-y-2 rounded-sm pt-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper-ink"
                >
                  <span className="relative block h-0.5 overflow-hidden rounded-full bg-paper-rule">
                    {isActive ? (
                      <span
                        key={active}
                        className="hero-progress absolute inset-0 origin-left"
                        style={{
                          backgroundColor: s.washColor,
                          animation: running ? `hero-progress ${STEP_DURATION_MS}ms linear forwards` : "none",
                        }}
                        onAnimationEnd={(e) => {
                          if (e.animationName === "hero-progress") {
                            setActive((a) => (a + 1) % scenes.length);
                          }
                        }}
                      />
                    ) : (
                      i < active && <span className="absolute inset-0 bg-paper-ink/40" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "block text-[13px] font-medium transition-colors",
                      isActive ? "text-paper-ink" : "text-paper-muted group-hover:text-paper-ink"
                    )}
                  >
                    {s.label}
                  </span>
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

        {/* Caption */}
        <p
          key={active}
          id="hero-panel"
          role="tabpanel"
          aria-labelledby={`hero-tab-${active}`}
          className="hero-caption min-h-[3.2em] max-w-[52ch] text-[17px] leading-[1.6] text-paper-muted"
        >
          {scene.caption}
        </p>
        <p className="text-[12px] text-paper-muted">
          Painted from Sentinel-2 cloudless imagery (EOX, CC BY 4.0) around the demo sites. The plots and readings are illustrations of what Delta records.
        </p>
      </div>

      {/* Right Column, Rows 1-2: Authentic Watercolor painting running off the page */}
      <figure
        ref={rootRef}
        className="hero-art relative -mx-6 sm:mx-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
      >
        <p
          key={active}
          aria-hidden
          className="hero-caption absolute left-[14%] top-[4%] z-10 hidden whitespace-pre font-mono text-[11px] tabular-nums text-paper-muted sm:block"
        >
          {scene.readout}
        </p>

        {/* no frame: the painting thins into the paper at its edges */}
        <div className="relative">
          {/* ink, then the colour washing in (our shader; art from scripts/render-hero-watercolour.ts) */}
          <DrawnWatercolor
            key={scene.art}
            art={scene.art}
            alt={scene.alt}
            meta={scene.meta}
            active={true}
            paused={paused}
          />

          {/* the plot, the photo points and the reading card, over the painting */}
          <div
            key={`overlay-${active}`}
            className="hda-ui absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            {scene.overlay}
          </div>
        </div>
      </figure>
    </div>
  );
}
