"use client";

import * as React from "react";
import type { DrawnWatercolorMeta } from "./DrawnWatercolor";
import WATERCOLOUR from "./watercolour.json";

export interface HeroScene {
  label: string;
  art: string;
  alt: string;
  readout: string;
  caption: React.ReactNode;
  washColor: string;
  meta: DrawnWatercolorMeta;
  /** Where the slow drift grows from, as a CSS transform-origin. */
  origin: string;
  /** The plot and its photo points: they lie on the painting and drift with it. */
  marks: React.ReactNode;
  /** The reading card: it floats above the painting and stays put. */
  card: React.ReactNode;
}

const at = (x: number, y: number, d: number) => ({ "--x": x, "--y": y, "--d": d }) as React.CSSProperties;

function Pin({ x, y, d, color, selected }: { x: number; y: number; d: number; color: string; selected?: boolean }) {
  return <span className={selected ? "hda-pt is-sel" : "hda-pt"} style={{ ...at(x, y, d), "--pt": color } as React.CSSProperties} />;
}

function Card({ x, y, color, title, status, rows }: { x: number; y: number; color: string; title: string; status: string; rows: [label: string, value: string, good?: boolean][] }) {
  return (
    <div className="hda-pane" style={at(x, y, 2.4)}>
      <div className="rounded-lg border bg-[#F7F3EA]/95 p-3 shadow-lg" style={{ borderColor: `${color}4D` }}>
        <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-wider" style={{ color }}>
          <span>{title}</span>
          <span className="flex items-center gap-1 text-[10px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            {status}
          </span>
        </div>
        <div className="mt-1.5 space-y-1 font-mono text-[12px] text-[#1C1B18]">
          {rows.map(([label, value, good]) => (
            <div key={label} className="flex justify-between gap-4">
              <span className="text-[#6B6357]">{label}</span>
              <span className={good ? "font-semibold text-emerald-700" : "font-semibold"}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A plot boundary, drawn by hand rather than ruled: a loose closed curve with a pale halo under
 * the coloured line, so it reads as a place on the land and on dark forest and pale water alike.
 */
function Plot({ d, color, dashed = true }: { d: string; color: string; dashed?: boolean }) {
  return (
    <>
      <path d={d} fill={color} fillOpacity="0.13" stroke="#F7F3EA" strokeWidth="4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeDasharray={dashed ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />
    </>
  );
}

function Plots({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="hda-area">
      {children}
    </svg>
  );
}

const GREEN = "#007A5A";
const BLUE = "#2674BA";
const VIOLET = "#7C65B0";
const AMBER = "#D97706";

export const HERO_SCENES: HeroScene[] = [
  {
    label: "Capture",
    art: "mangrove",
    alt: "Watercolour illustration of a mangrove delta from above: dark green forest blocks cut by pale creeks that run down to the sea",
    readout: "ILLUSTRATION   MANGROVE DELTA",
    washColor: GREEN,
    meta: WATERCOLOUR.mangrove,
    origin: "58% 46%",
    caption: (
      <>
        A field team photographs the plot before and after, and every photo is <mark className="hdr-key">fingerprinted</mark> the moment it arrives.
      </>
    ),
    marks: (
      <>
        <Plots>
          <Plot d="M45 33 C50 27 59 26 63 33 C67 41 66 55 60 62 C54 67 47 64 45 55 C43 47 42 39 45 33 Z" color={GREEN} />
        </Plots>
        <Pin x={0.53} y={0.5} d={1.2} color={GREEN} />
      </>
    ),
    card: (
      <Card
        x={0.57}
        y={0.07}
        color={GREEN}
        title="Field intake"
        status="Received"
        rows={[
          ["Device", "Sony A7 IV, 24mm"],
          ["GPS fix", "Inside the plot"],
          ["SHA-256", "9e41…c07a"],
        ]}
      />
    ),
  },
  {
    label: "Check",
    art: "river",
    alt: "Watercolour illustration of a braided river from above: teal channels winding between sandbars and green floodplain",
    readout: "ILLUSTRATION   BRAIDED RIVER",
    washColor: BLUE,
    meta: WATERCOLOUR.river,
    origin: "44% 54%",
    caption: (
      <>
        Every photo is checked across every project on record, so no picture can be <mark className="hdr-key">claimed twice</mark>.
      </>
    ),
    marks: (
      <>
        <Plots>
          <Plot d="M13 58 C17 52 25 51 29 57 C32 63 31 73 26 78 C21 82 15 79 13 72 C11 66 11 62 13 58 Z" color={BLUE} />
          <Plot d="M61 16 C66 10 75 10 79 16 C83 23 81 34 76 39 C70 43 63 40 61 32 C59 26 59 20 61 16 Z" color={GREEN} />
          {/* the comparison between the two plots' photos */}
          <path d="M 22 66 Q 40 22 70 25" fill="none" stroke="#F7F3EA" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          <path d="M 22 66 Q 40 22 70 25" fill="none" stroke={BLUE} strokeWidth="2" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
        </Plots>
        <Pin x={0.22} y={0.66} d={1.2} color={BLUE} />
        <Pin x={0.7} y={0.25} d={1.6} color={GREEN} />
      </>
    ),
    card: (
      <Card
        x={0.07}
        y={0.08}
        color={BLUE}
        title="Duplicate check"
        status="Clear"
        rows={[
          ["64-bit dHash", "b0101100…"],
          ["Nearest photo", "18 bits apart"],
          ["Same picture", "None on record", true],
        ]}
      />
    ),
  },
  {
    label: "Review",
    art: "haor",
    alt: "Watercolour illustration of a wetland basin from above: green islands in shallow turquoise water, rust-coloured shores",
    readout: "ILLUSTRATION   WETLAND BASIN",
    washColor: VIOLET,
    meta: WATERCOLOUR.haor,
    origin: "50% 58%",
    caption: (
      <>
        Two reviewers from an <mark className="hdr-key">independent organisation</mark> must agree. Nobody reviews their own work.
      </>
    ),
    marks: (
      <>
        <Plots>
          <Plot d="M37 46 C44 38 58 37 64 45 C69 54 68 70 60 78 C52 84 42 81 38 71 C35 62 33 53 37 46 Z" color={VIOLET} />
        </Plots>
        <Pin x={0.46} y={0.56} d={1.2} color={VIOLET} />
        <Pin x={0.57} y={0.68} d={1.6} color={BLUE} />
      </>
    ),
    card: (
      <Card
        x={0.57}
        y={0.07}
        color={VIOLET}
        title="2-of-N quorum"
        status="Signed"
        rows={[
          ["Reviewer 1", "Approved"],
          ["Reviewer 2", "Approved"],
          ["Own organisation", "Neither", true],
        ]}
      />
    ),
  },
  {
    label: "Verify",
    art: "coast",
    alt: "Watercolour illustration of a coast from above: pale blue sea, a long sand spit and green hills inland",
    readout: "ILLUSTRATION   COAST",
    washColor: AMBER,
    meta: WATERCOLOUR.coast,
    origin: "40% 50%",
    caption: (
      <>
        Anyone can drop a photo onto a proof page and check it against the record, <mark className="hdr-key">without trusting us</mark>.
      </>
    ),
    marks: (
      <>
        <Plots>
          <Plot d="M43 36 C49 28 60 28 65 35 C69 43 68 57 62 64 C55 70 47 67 44 58 C41 50 40 42 43 36 Z" color={AMBER} dashed={false} />
        </Plots>
        <Pin x={0.54} y={0.49} d={1.2} color={AMBER} selected />
      </>
    ),
    card: (
      <Card
        x={0.06}
        y={0.1}
        color={AMBER}
        title="Photo check"
        status="Public"
        rows={[
          ["Proof", "Approved record"],
          ["SHA-256", "9e41…c07a"],
          ["Dropped photo", "Exact match", true],
        ]}
      />
    ),
  },
];
