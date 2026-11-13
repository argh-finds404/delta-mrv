"use client";

import * as React from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  ChevronsLeftRight,
  Columns2,
  ImageOff,
  RotateCcw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { cn } from "@/src/lib/utils";

export interface EvidenceImage {
  url: string;
  sha256: string;
  /** When the file's own metadata says it was taken. Null when the file does not say. */
  capturedAt: string | null;
  dhash?: string;
  width?: number;
  height?: number;
  /** Where the photo was taken, if the file says. Shown in mono under the image. */
  gps?: { lat: number; lng: number };
}

export interface EvidencePairProps {
  /** Baseline before image */
  before: EvidenceImage;
  /** Re-survey after image */
  after: EvidenceImage;
  /** Label for before image (default: "Before") */
  beforeLabel?: string;
  /** Label for after image (default: "After") */
  afterLabel?: string;
  /** Extra rows for the collapsed detail strip (camera, boundary, activity…) */
  details?: React.ReactNode;
  /** Optional theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/** Matches the grid gap-4 between the two pictures in side-by-side mode */
const SIDE_GAP = 16;
/** 8px gap plus two 20px caption lines */
const CAPTION_RESERVE = 48;
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
const STEP = 2;
const BIG_STEP = 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** "12 Mar 2024", in UTC so the server render and the browser agree. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCoordinate(gps: { lat: number; lng: number }): string {
  const ns = gps.lat >= 0 ? "N" : "S";
  const ew = gps.lng >= 0 ? "E" : "W";
  return `${Math.abs(gps.lat).toFixed(4)}° ${ns}, ${Math.abs(gps.lng).toFixed(4)}° ${ew}`;
}

/**
 * EvidencePair — the comparison, and the primary interaction in the Lab.
 * Authority: docs/19-LAYOUT-SPEC.md §2, §5, §7; docs/18-VISUAL-CORRECTION.md §2–§3.
 *
 * Top to bottom: a 40px control row, the image area (takes everything left over) with
 * captions directly beneath the picture and never inside it, and a 32px detail strip.
 */
export function EvidencePair({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  details,
  theme = "field",
  className,
}: EvidencePairProps) {
  const isPaper = theme === "paper";

  const [position, setPosition] = React.useState<number>(50); // divider, % of image width
  const [broken, setBroken] = React.useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = React.useState<"slider" | "side-by-side">("slider");
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [interaction, setInteraction] = React.useState<"idle" | "slider" | "pan">("idle");
  const [showStrip, setShowStrip] = React.useState<boolean>(false);

  const imageBoxRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stage, setStage] = React.useState<{ w: number; h: number } | null>(null);

  // Container-query units mis-resolve when the stage sits at its min-height, so the
  // picture is sized in pixels from the stage actually on screen.
  useIsoLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setStage({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const drag = React.useRef<{
    mode: "slider" | "pan";
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  // One transform for both images, so they stay registered at every zoom.
  const imageStyle: React.CSSProperties = {
    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
    transformOrigin: "center center",
    transition: interaction === "pan" ? "none" : "transform 120ms cubic-bezier(0.2, 0, 0, 1)",
  };

  const aspect = (before.width ?? 800) / (before.height ?? 600);
  // Largest picture that fits `availableWidth` once the caption beneath it is reserved
  const fitWidth = (availableWidth: number) =>
    stage ? Math.max(0, Math.floor(Math.min(availableWidth, (stage.h - CAPTION_RESERVE) * aspect))) : 0;

  const setZoomLevel = (next: number) => {
    const z = clamp(next, 1, 4);
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  };

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPosition(50);
  };

  const positionFromClientX = (clientX: number) => {
    const rect = imageBoxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPosition(clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100));
  };

  // ---- pointer: the whole image area is the control (docs/19 §7) ----
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const onHandle = (e.target as HTMLElement).closest("[data-handle]") !== null;
    // Zoomed in, dragging the picture pans it; the divider is then moved from its
    // handle, by keyboard, or by a plain click.
    const mode = viewMode === "slider" && (zoom <= 1 || onHandle) ? "slider" : zoom > 1 ? "pan" : null;
    if (!mode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    setInteraction(mode);
    if (mode === "slider") positionFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "slider") {
      positionFromClientX(e.clientX);
      return;
    }
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const rect = imageBoxRef.current?.getBoundingClientRect();
    const maxX = rect ? ((zoom - 1) * rect.width) / (2 * zoom) : 0;
    const maxY = rect ? ((zoom - 1) * rect.height) / (2 * zoom) : 0;
    setPan({
      x: clamp(d.panX + dx / zoom, -maxX, maxX),
      y: clamp(d.panY + dy / zoom, -maxY, maxY),
    });
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // A click, not a drag, while zoomed: jump the divider there.
    if (d.mode === "pan" && !d.moved && viewMode === "slider") positionFromClientX(e.clientX);
    drag.current = null;
    setInteraction("idle");
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // ---- keyboard: arrows 2%, shift+arrows 10%, Home / End ----
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (viewMode !== "slider") return;
    const step = e.shiftKey ? BIG_STEP : STEP;
    const next =
      e.key === "ArrowLeft" ? position - step
      : e.key === "ArrowRight" ? position + step
      : e.key === "Home" ? 0
      : e.key === "End" ? 100
      : null;
    if (next === null) return;
    e.preventDefault();
    setPosition(clamp(next, 0, 100));
  };

  const sliderMode = viewMode === "slider";
  const cursor =
    zoom > 1 ? (interaction === "pan" ? "cursor-grabbing" : "cursor-grab") : sliderMode ? "cursor-ew-resize" : "cursor-default";

  /** The picture itself. Pills live inside its box, captions never do. */
  const picture = (img: EvidenceImage, label: string, side: "left" | "right") => (
    <>
      {broken[img.url] ? (
        // a stored original that does not load is said plainly, never shown as a broken icon
        <span className="flex size-full flex-col items-center justify-center gap-2 bg-field-raised p-6 text-center text-[13px] text-field-muted">
          <ImageOff className="size-5" aria-hidden />
          The {label.toLowerCase()} photo could not be loaded from storage.
        </span>
      ) : (
        <Image
          src={img.url}
          alt={img.capturedAt ? `${label} photo, captured ${formatDate(img.capturedAt)}` : `${label} photo`}
          width={img.width ?? 800}
          height={img.height ?? 600}
          unoptimized
          draggable={false}
          style={imageStyle}
          onError={() => setBroken((b) => ({ ...b, [img.url]: true }))}
          className="pointer-events-none size-full select-none object-fill"
        />
      )}
      <span
        className={cn(
          "pointer-events-none absolute top-2 z-10 rounded-sm bg-field-abyss/70 px-2 py-1 text-xs leading-4 text-field-text",
          side === "left" ? "left-2" : "right-2"
        )}
      >
        {label}
      </span>
    </>
  );

  const caption = (img: EvidenceImage, label: string, align: "left" | "right") => (
    <p className={cn("min-w-0 text-[13px] leading-5 text-field-muted", align === "right" && "text-right")}>
      <span className="block truncate">
        {img.capturedAt ? `${label} capture · ${formatDate(img.capturedAt)}` : `${label} · capture time not in the file`}
      </span>
      {img.gps && (
        <span className="block truncate font-mono tabular-nums text-field-text">{formatCoordinate(img.gps)}</span>
      )}
    </p>
  );

  const segment = (active: boolean) =>
    cn(
      "flex h-8 items-center gap-2 whitespace-nowrap rounded-sm px-3 text-[13px] transition-colors duration-[120ms]",
      active ? "bg-field-raised text-field-text" : "text-field-muted hover:text-field-text"
    );

  const iconButton =
    "flex size-8 items-center justify-center rounded-sm text-field-muted transition-colors duration-[120ms] hover:text-field-text disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {/* Controls: one 40px row */}
      <div className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 select-none">
        <div role="group" aria-label="View mode" className="flex items-center rounded-lg border border-field-hairline bg-field-canopy p-1">
          <button type="button" aria-pressed={sliderMode} onClick={() => setViewMode("slider")} className={segment(sliderMode)}>
            <SlidersHorizontal className="size-3.5" aria-hidden="true" /> Slider
          </button>
          <button type="button" aria-pressed={!sliderMode} onClick={() => setViewMode("side-by-side")} className={segment(!sliderMode)}>
            <Columns2 className="size-3.5" aria-hidden="true" /> Side by side
          </button>
        </div>

        <div role="group" aria-label="Zoom" className="flex items-center rounded-lg border border-field-hairline bg-field-canopy p-1">
          <button type="button" title="Zoom out" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoomLevel(zoom - 0.5)} className={iconButton}>
            <ZoomOut className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-12 text-center font-mono text-[13px] tabular-nums text-field-text" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => setZoomLevel(zoom + 0.5)} className={iconButton}>
            <ZoomIn className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Reset zoom and divider"
            aria-label="Reset zoom and divider"
            disabled={zoom === 1 && position === 50}
            onClick={reset}
            className={iconButton}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Image area. The picture sizes itself to its aspect ratio inside the space left, and its
          captions sit directly beneath it at the same width, outside its box (docs/19 §7). */}
      <div ref={stageRef} className={cn("relative min-h-[320px] flex-1", !stage && "invisible")}>
        {sliderMode ? (
          <div className="absolute inset-0 flex items-start justify-center">
            <div className="flex flex-col gap-2" style={{ width: fitWidth(stage?.w ?? 0) }}>
              <div
                ref={imageBoxRef}
                role="slider"
                tabIndex={0}
                aria-label={`Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={position}
                aria-valuetext={`${position}% ${beforeLabel.toLowerCase()}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                onKeyDown={onKeyDown}
                style={{ aspectRatio: aspect }}
                className={cn(
                  "relative w-full touch-none select-none overflow-hidden rounded-lg border border-field-hairline bg-field-abyss",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                  cursor
                )}
              >
                <div className="absolute inset-0">{picture(before, beforeLabel, "left")}</div>
                {/* After image, clipped to everything right of the divider */}
                <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
                  {picture(after, afterLabel, "right")}
                </div>

                {/* Divider: a 4px line and a 32px grab target that appears on hover */}
                <div data-handle className="group absolute inset-y-0 z-20 w-8 -translate-x-1/2 cursor-ew-resize" style={{ left: `${position}%` }}>
                  <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-field-text/60" />
                  <div
                    className={cn(
                      "absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-[120ms]",
                      interaction === "slider" ? "bg-field-raised/90" : "bg-transparent group-hover:bg-field-raised/90"
                    )}
                  >
                    <ChevronsLeftRight className="size-4 text-field-text/70" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 select-none">
                {caption(before, beforeLabel, "left")}
                {caption(after, afterLabel, "right")}
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-1 gap-4">
            {[
              { img: before, label: beforeLabel, side: "left" as const },
              { img: after, label: afterLabel, side: "right" as const },
            ].map(({ img, label, side }) => (
              <div key={label} className="relative flex items-start justify-center">
                <div className="flex flex-col gap-2" style={{ width: fitWidth(((stage?.w ?? 0) - SIDE_GAP) / 2) }}>
                  <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endPointer}
                    onPointerCancel={endPointer}
                    style={{ aspectRatio: aspect }}
                    className={cn("relative w-full touch-none select-none overflow-hidden rounded-lg border border-field-hairline bg-field-abyss", cursor)}
                  >
                    {picture(img, label, side)}
                  </div>
                  <div className="select-none">{caption(img, label, side)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail strip: 32px when closed */}
      <div className="shrink-0 rounded-lg border border-field-hairline bg-field-canopy">
        <button
          type="button"
          aria-expanded={showStrip}
          onClick={() => setShowStrip((v) => !v)}
          className="flex h-8 w-full items-center justify-between px-3 text-[13px] text-field-muted transition-colors duration-[120ms] hover:text-field-text"
        >
          <span>Capture details</span>
          {showStrip ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
        </button>

        {showStrip && (
          <div className="grid max-h-56 grid-cols-1 gap-4 overflow-y-auto border-t border-field-hairline p-4 text-[13px] leading-5 md:grid-cols-2">
            {[
              { img: before, label: beforeLabel },
              { img: after, label: afterLabel },
            ].map(({ img, label }) => (
              <dl key={label} className="space-y-1">
                <dt className="text-field-text">{label}</dt>
                <dd className="flex items-center justify-between gap-4">
                  <span className="text-field-muted">Captured</span>
                  <span className="font-mono tabular-nums text-field-text">{img.capturedAt ?? "Not in the file"}</span>
                </dd>
                <dd className="flex items-center justify-between gap-4">
                  <span className="text-field-muted">SHA-256</span>
                  <HashDisplay hash={img.sha256} variant="truncated" theme={theme} />
                </dd>
              </dl>
            ))}
            {details && <div className={cn("space-y-1 md:col-span-2", !isPaper && "border-t border-field-hairline pt-4")}>{details}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
