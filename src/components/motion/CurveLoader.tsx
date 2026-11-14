import { cn } from "@/src/lib/utils";

// A loader drawn from a mathematical curve (after the "math curve loaders" idea): a short ink
// stroke runs along a rose or a lissajous figure while the whole curve sits faintly beneath it,
// like a line being traced on paper. Pure SVG and CSS, so it costs no script; with reduced motion
// the stroke stands still. Decorative: the text beside it says what is happening.

const SIZE = 100;
const C = SIZE / 2;

/** Points of r = cos(k·θ) (a rose), or x = sin(a·t), y = sin(b·t) (a lissajous), scaled to the box. */
function curvePath(kind: "rose" | "lissajous", steps = 360): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    let x: number, y: number;
    if (kind === "rose") {
      const r = Math.cos(3 * t) * 0.42 * SIZE;
      [x, y] = [C + r * Math.cos(t), C + r * Math.sin(t)];
    } else {
      [x, y] = [C + Math.sin(3 * t + Math.PI / 2) * 0.42 * SIZE, C + Math.sin(2 * t) * 0.42 * SIZE];
    }
    pts.push(`${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${pts.join(" ")} Z`;
}

const PATHS = { rose: curvePath("rose"), lissajous: curvePath("lissajous") } as const;

export function CurveLoader({ kind = "rose", className }: { kind?: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className={cn("curve-loader size-5 shrink-0", className)}>
      <path d={PATHS[kind]} pathLength={100} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={5} strokeLinejoin="round" />
      <path d={PATHS[kind]} pathLength={100} fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" className="curve-loader-run" />
    </svg>
  );
}
