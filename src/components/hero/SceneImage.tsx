import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

// A hero scene: a real, credited photograph of the Sundarbans (public/images/life/credits.json)
// with Delta's annotations drawn over it. felt.com's sequence, told with a photograph: it arrives
// as a toned black-and-white sketch, the colour sweeps in, then boundaries draw, pins pop and the
// card rises. An organic edge mask dissolves it into the paper. globals.css times every step.
//
// Overlay coordinates are a 1000 × 700 space matching the frame's 10:7 crop of the photograph,
// so a pin placed on a boat stays on it at every width.

export type Pt = [number, number];

export const VIEW = { w: 1000, h: 700 };

const INK = "#1E2723";
const HALO = "rgba(244, 241, 234, 0.8)";
const LIME = "#D7F6B8";

const path = (pts: Pt[]) => `M${pts.map((p) => p.join(" ")).join("L")}Z`;
const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** A registered plot boundary: a dashed line over a paper halo, drawn in, then washed. */
export function Plot({ id, pts, tone = LIME }: { id: string; pts: Pt[]; tone?: string }) {
  const d = path(pts);
  return (
    <g>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW.w} height={VIEW.h}>
        <path className="scene-draw" d={d} pathLength={1} fill="none" stroke="#fff" strokeWidth={16} />
      </mask>
      <path className="scene-fill" d={d} fill={tone} fillOpacity={0.3} />
      <path d={d} mask={`url(#${id})`} fill="none" stroke={HALO} strokeWidth={7} strokeLinejoin="round" />
      <path d={d} mask={`url(#${id})`} fill="none" stroke={INK} strokeWidth={2.75} strokeDasharray="11 7" strokeLinejoin="round" />
    </g>
  );
}

/** Viewfinder corners: the frame a camera draws around what it is about to record. */
export function Brackets({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const k = Math.min(w, h) * 0.16;
  const corners = [
    `M${x} ${y + k}V${y}H${x + k}`,
    `M${x + w - k} ${y}H${x + w}V${y + k}`,
    `M${x + w} ${y + h - k}V${y + h}H${x + w - k}`,
    `M${x + k} ${y + h}H${x}V${y + h - k}`,
  ];
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {corners.map((d) => (
        <path key={d} className="scene-draw" d={d} pathLength={1} stroke="rgba(9,18,16,.45)" strokeWidth={8} />
      ))}
      {corners.map((d) => (
        <path key={`${d}w`} className="scene-draw" d={d} pathLength={1} stroke="#fff" strokeWidth={3.5} />
      ))}
    </g>
  );
}

/** A photo point: pops in; the newest one keeps a slow pulse. */
export function Pin({ at: [x, y], i = 0, pulse = false }: { at: Pt; i?: number; pulse?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} style={order(i)} className="scene-pin">
      {pulse && <circle className="scene-pulse" r="17" fill="none" stroke="#fff" strokeWidth="2.5" />}
      <g className="scene-pin-body">
        <circle r="20" fill={HALO} />
        <circle r="16" fill={INK} />
        <rect x="-7" y="-5" width="14" height="10" rx="2" fill={LIME} />
        <circle r="2.7" fill={INK} />
      </g>
    </g>
  );
}

/** A small reading stamped on the photograph, the way a capture app stamps one. */
export function Chip({ at: [x, y], label, value, i = 0 }: { at: Pt; label: string; value: string; i?: number }) {
  return (
    <foreignObject x={x} y={y} width="380" height="60" className="scene-chip" style={order(i)}>
      <div className="inline-flex items-center gap-3 rounded-lg bg-[#101A18]/85 px-4 py-3 text-[21px] leading-none text-[#E8EFEC]">
        <span className="size-2.5 rounded-full bg-[#D7F6B8]" aria-hidden />
        <span className="text-[#A9BBB5]">{label}</span>
        <span className="font-mono tabular-nums">{value}</span>
      </div>
    </foreignObject>
  );
}

/** The photograph twice (a toned sketch, and the colour that sweeps over it), plus the annotations. */
export function SceneImage({ photo, alt, priority = false, children }: { photo: string; alt: string; priority?: boolean; children: ReactNode }) {
  const sizes = "(min-width: 1024px) 58vw, 100vw";
  const src = `/images/life/${photo}`;
  // the edge mask stays still on the outer frame; the photo and its pins push in together inside it
  return (
    <div className="scene-edge absolute inset-0 overflow-hidden">
      <div className="scene-media absolute inset-0">
        <Image src={src} alt="" fill priority={priority} sizes={sizes} className="scene-ink-img scene-mono object-cover" />
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="scene-wash-img object-cover" />
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          {children}
        </svg>
      </div>
    </div>
  );
}
