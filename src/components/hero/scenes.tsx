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
  overlay: React.ReactNode;
}

export const HERO_SCENES: HeroScene[] = [
  {
    label: "Capture",
    art: "mangrove",
    alt: "Watercolour painted from satellite imagery of the Sundarbans mangrove creeks near Koyra, Khulna",
    readout: "22.3250° N  89.3250° E   SUNDARBANS",
    washColor: "#007A5A",
    meta: WATERCOLOUR.mangrove,
    caption: (
      <>
        A field team photographs the plot before and after, and every photo is{" "}
        <mark className="hdr-key">fingerprinted</mark> the moment it arrives.
      </>
    ),
    overlay: (
      <>
        {/* restoration boundary plot */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="hda-area edge-dash">
          <polygon
            points="34,36 64,32 68,66 38,70"
            className="fill-[rgba(0,122,90,0.15)] stroke-[#007A5A] stroke-[1.5]"
          />
        </svg>

        {/* GPS location pin */}
        <span
          className="hda-pt hda-pt-green"
          style={{ "--x": "0.60", "--y": "0.62", "--d": "0" } as React.CSSProperties}
        />

        {/* Floating telemetry card */}
        <div
          className="hda-pane"
          style={{ "--x": "0.58", "--y": "0.14", "--d": "0.8" } as React.CSSProperties}
        >
          <div className="rounded-lg border border-[#007A5A]/30 bg-[#F7F3EA]/95 p-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-wider text-[#007A5A]">
              <span>Field Intake</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Grounded
              </span>
            </div>
            <div className="mt-1.5 space-y-1 font-mono text-[12px] text-[#1C1B18]">
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Device</span>
                <span className="font-semibold">Sony A7 IV • 24mm</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">GPS Fix</span>
                <span className="font-semibold">In-Polygon (0.0m)</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">SHA-256</span>
                <span className="font-semibold">9e41…c07a</span>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    label: "Check",
    art: "river",
    alt: "Watercolour painted from satellite imagery of the Padma and Meghna rivers meeting near Chandpur",
    readout: "23.2500° N  90.6200° E   PADMA–MEGHNA",
    washColor: "#2674BA",
    meta: WATERCOLOUR.river,
    caption: (
      <>
        Every photo is checked across every project on record, so no picture can be{" "}
        <mark className="hdr-key">claimed twice</mark>.
      </>
    ),
    overlay: (
      <>
        {/* Plot A (Claimed) and Plot B (Reference) */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="hda-area edge-dash">
          <polygon
            points="14,30 28,26 32,46 16,50"
            className="fill-[rgba(38,116,186,0.18)] stroke-[#2674BA] stroke-[1.5]"
          />
          <polygon
            points="68,44 88,40 92,64 72,68"
            className="fill-[rgba(0,122,90,0.18)] stroke-[#007A5A] stroke-[1.5]"
          />
          {/* Radar vector connecting the two plots */}
          <path
            d="M 28 38 Q 50 20 78 52"
            fill="none"
            stroke="#2674BA"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="opacity-70"
          />
        </svg>

        {/* Radar pin on Plot A */}
        <span
          className="hda-pt hda-pt-blue"
          style={{ "--x": "0.22", "--y": "0.38", "--d": "0" } as React.CSSProperties}
        />
        {/* Radar pin on Plot B */}
        <span
          className="hda-pt hda-pt-green"
          style={{ "--x": "0.78", "--y": "0.52", "--d": "0.4" } as React.CSSProperties}
        />

        {/* Floating duplicate telemetry card */}
        <div
          className="hda-pane"
          style={{ "--x": "0.08", "--y": "0.12", "--d": "0.8" } as React.CSSProperties}
        >
          <div className="rounded-lg border border-[#2674BA]/30 bg-[#F7F3EA]/95 p-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-wider text-[#2674BA]">
              <span>Duplicate check</span>
              <span className="flex items-center gap-1 text-[10px] text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                Clear
              </span>
            </div>
            <div className="mt-1.5 space-y-1 font-mono text-[12px] text-[#1C1B18]">
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">64-bit dHash</span>
                <span className="font-semibold">b0101100…</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Hamming Dist</span>
                <span className="font-semibold">&lt;~&gt; 18 bits</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Evaluation</span>
                <span className="font-semibold text-emerald-700">0 Collisions</span>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    label: "Review",
    art: "haor",
    alt: "Watercolour painted from satellite imagery of the Tanguar Haor wetland, Sunamganj",
    readout: "25.1250° N  91.0750° E   TANGUAR HAOR",
    washColor: "#7C65B0",
    meta: WATERCOLOUR.haor,
    caption: (
      <>
        Two reviewers from an <mark className="hdr-key">independent organisation</mark> must agree. Nobody reviews their own work.
      </>
    ),
    overlay: (
      <>
        {/* conservation tract */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="hda-area edge-dash">
          <polygon
            points="42,28 78,24 84,62 48,66"
            className="fill-[rgba(124,101,176,0.15)] stroke-[#7C65B0] stroke-[1.5]"
          />
        </svg>

        <span
          className="hda-pt"
          style={{ "--pt": "#7C65B0", "--x": "0.58", "--y": "0.42", "--d": "0" } as React.CSSProperties}
        />
        <span
          className="hda-pt"
          style={{ "--pt": "#2674BA", "--x": "0.68", "--y": "0.50", "--d": "0.3" } as React.CSSProperties}
        />

        {/* Floating review card */}
        <div
          className="hda-pane"
          style={{ "--x": "0.54", "--y": "0.10", "--d": "0.8" } as React.CSSProperties}
        >
          <div className="rounded-lg border border-[#7C65B0]/30 bg-[#F7F3EA]/95 p-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-wider text-[#7C65B0]">
              <span>2-of-N Quorum</span>
              <span className="flex items-center gap-1 text-[10px] text-purple-700">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />
                Signed
              </span>
            </div>
            <div className="mt-1.5 space-y-1 font-mono text-[12px] text-[#1C1B18]">
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Reviewer 1</span>
                <span className="font-semibold">Approved</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Reviewer 2</span>
                <span className="font-semibold">Approved</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Own organisation</span>
                <span className="font-semibold text-emerald-700">Neither</span>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    label: "Verify",
    art: "coast",
    alt: "Watercolour painted from satellite imagery of Sonadia island and the coast near Cox’s Bazar",
    readout: "21.4750° N  91.8750° E   SONADIA",
    washColor: "#D97706",
    meta: WATERCOLOUR.coast,
    caption: (
      <>
        Anyone can drop a photo onto a proof page and check it against the record,{" "}
        <mark className="hdr-key">without trusting us</mark>.
      </>
    ),
    overlay: (
      <>
        {/* finalized anchor boundary */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="hda-area">
          <polygon
            points="22,36 52,32 58,68 28,72"
            className="fill-[rgba(217,119,6,0.18)] stroke-[#D97706] stroke-[1.8]"
          />
        </svg>

        <span
          className="hda-pt hda-pt-orange is-sel"
          style={{ "--x": "0.42", "--y": "0.52", "--d": "0" } as React.CSSProperties}
        />

        {/* Floating on-chain proof card */}
        <div
          className="hda-pane"
          style={{ "--x": "0.08", "--y": "0.14", "--d": "0.8" } as React.CSSProperties}
        >
          <div className="rounded-lg border border-[#D97706]/30 bg-[#F7F3EA]/95 p-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-wider text-[#D97706]">
              <span>Photo check</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                Public
              </span>
            </div>
            <div className="mt-1.5 space-y-1 font-mono text-[12px] text-[#1C1B18]">
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Proof</span>
                <span className="font-semibold">Approved record</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">SHA-256</span>
                <span className="font-semibold">9e41…c07a</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#6B6357]">Drop Photo</span>
                <span className="font-semibold text-emerald-700">Exact match</span>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
];
