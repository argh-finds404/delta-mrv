"use client";

import * as React from "react";

/**
 * Plays an explanatory sequence once, when it scrolls into view (docs/06-DESIGN-SYSTEM.md §6).
 * Children opt in with `.reveal-item` (and `--i` for order) or `.reveal-line`; the CSS lives in
 * globals.css under prefers-reduced-motion: no-preference. Without JS, or with reduced motion,
 * everything is simply visible: nothing is hidden until this has armed it.
 */
export function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    el.dataset.reveal = "armed";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
