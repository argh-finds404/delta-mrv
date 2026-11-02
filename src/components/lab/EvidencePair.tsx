"use client";

import * as React from "react";
import Image from "next/image";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Columns,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { cn } from "@/src/lib/utils";

export interface EvidenceImage {
  url: string;
  sha256: string;
  capturedAt: string;
  dhash: string;
  width?: number;
  height?: number;
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
  /** Optional theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * EvidencePair — Synchronized comparison slider and image viewer.
 * Authority: docs/18-VISUAL-CORRECTION.md §2 & §3.
 * Primary interaction in the Lab. Fills its container and dominates.
 * Handle is large enough to grab without aiming.
 * Hashes and capture times are in a collapsed strip below.
 */
export function EvidencePair({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  theme = "field",
  className,
}: EvidencePairProps) {
  const isPaper = theme === "paper";

  // Comparison slider position (0% - 100%, default 50%)
  const [sliderPos, setSliderPos] = React.useState<number>(50);
  const [isDraggingSlider, setIsDraggingSlider] = React.useState<boolean>(false);

  // Synced Zoom and Pan state
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState<boolean>(false);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // View mode: "slider" or "side-by-side"
  const [viewMode, setViewMode] = React.useState<"slider" | "side-by-side">("slider");

  // Metadata strip collapsed by default per §2
  const [showMetadata, setShowMetadata] = React.useState<boolean>(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSliderPos(50);
  };

  // Keyboard navigation for slider: Left / Right arrow keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (viewMode !== "slider") return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSliderPos((prev) => Math.max(0, prev - (e.shiftKey ? 10 : 2)));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSliderPos((prev) => Math.min(100, prev + (e.shiftKey ? 10 : 2)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSliderPos(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSliderPos(100);
    }
  };

  // Slider drag events
  const updateSliderFromClientX = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.round((x / rect.width) * 100);
    setSliderPos(percentage);
  };

  const handleSliderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSlider(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSliderPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSlider) return;
    updateSliderFromClientX(e.clientX);
  };

  const handleSliderPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSlider) {
      setIsDraggingSlider(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture release fallback
      }
    }
  };

  // Pan drag events (when zoom > 1)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1 || isDraggingSlider) return;
    setIsPanning(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxPan = 150 * (zoom - 1);
    const newX = Math.max(-maxPan, Math.min(panStartRef.current.x + dx, maxPan));
    const newY = Math.max(-maxPan, Math.min(panStartRef.current.y + dy, maxPan));
    setPan({ x: newX, y: newY });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture fallback
      }
    }
  };

  // Synchronized transform applied to both images
  const transformStyle: React.CSSProperties = {
    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
    transformOrigin: "center center",
    transition: isPanning ? "none" : "transform 100ms ease-out",
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex flex-col rounded-lg border outline-none transition-colors overflow-hidden",
        isPaper
          ? "border-paper-rule bg-paper-card"
          : "border-field-hairline bg-field-canopy",
        className
      )}
    >
      {/* Top Quiet Toolbar: Mode Switcher & Zoom (recedes behind the image) */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5 border-b text-xs select-none",
          isPaper ? "border-paper-rule bg-paper" : "border-field-hairline bg-field-raised"
        )}
      >
        <div className="flex items-center gap-2">
          {/* View Mode (quiet surface shift, no solid signal color per §3) */}
          <div className="flex items-center rounded border border-field-hairline p-0.5 bg-field-canopy">
            <button
              type="button"
              onClick={() => setViewMode("slider")}
              className={cn(
                "px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1",
                viewMode === "slider"
                  ? isPaper
                    ? "bg-paper-card text-paper-ink font-medium"
                    : "bg-field-raised text-field-text font-medium"
                  : "text-field-muted hover:text-field-text"
              )}
            >
              <Sliders className="size-3" /> Slider
            </button>
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              className={cn(
                "px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1",
                viewMode === "side-by-side"
                  ? isPaper
                    ? "bg-paper-card text-paper-ink font-medium"
                    : "bg-field-raised text-field-text font-medium"
                  : "text-field-muted hover:text-field-text"
              )}
            >
              <Columns className="size-3" /> Side by side
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          {viewMode === "slider" && (
            <span className="hidden md:inline text-[11px] text-field-muted">
              Step with ← / →
            </span>
          )}

          <div className="flex items-center gap-1 rounded border border-field-hairline p-0.5 bg-field-canopy">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              title="Zoom out"
              className="p-1 rounded text-field-muted hover:text-field-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] tabular-nums min-w-[36px] text-center text-field-text">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              title="Zoom in"
              className="p-1 rounded text-field-muted hover:text-field-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomIn className="size-3.5" />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset zoom"
                className="p-1 rounded text-review hover:text-field-text transition-colors"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Evidence Visualizer Canvas (Fills pane and dominates) */}
      {viewMode === "slider" ? (
        <div
          ref={containerRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          className={cn(
            "relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden select-none bg-field-abyss",
            zoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
          )}
        >
          {/* Base Layer: Before Image */}
          <div className="absolute inset-0 size-full pointer-events-none">
            <Image
              src={before.url}
              alt={beforeLabel}
              width={800}
              height={600}
              unoptimized
              style={transformStyle}
              className="size-full object-contain pointer-events-none"
            />
            {/* Minimal Label Badge Top Left */}
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-field-abyss/85 border border-field-hairline text-xs text-field-muted z-10">
              {beforeLabel}
            </div>
          </div>

          {/* Overlay Layer: After Image clipped to slider position */}
          <div
            className="absolute inset-0 size-full pointer-events-none overflow-hidden"
            style={{
              clipPath: `inset(0 0 0 ${sliderPos}%)`,
            }}
          >
            <Image
              src={after.url}
              alt={afterLabel}
              width={800}
              height={600}
              unoptimized
              style={transformStyle}
              className="size-full object-contain pointer-events-none"
            />
            {/* Minimal Label Badge Top Right */}
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-field-abyss/85 border border-field-hairline text-xs text-field-muted z-10">
              {afterLabel}
            </div>
          </div>

          {/* Large, Easy-to-Grab Divider Handle per §3 */}
          <div
            className="absolute top-0 bottom-0 z-20"
            style={{
              left: `${sliderPos}%`,
              transform: "translateX(-50%)",
            }}
          >
            {/* Vertical hairline divider */}
            <div className="h-full w-0.5 bg-field-muted/70" />

            {/* Draggable center handle (large enough to grab without aiming) */}
            <div
              role="slider"
              aria-label="Image comparison slider"
              aria-valuenow={sliderPos}
              aria-valuemin={0}
              aria-valuemax={100}
              tabIndex={0}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-10 rounded border border-field-hairline flex items-center justify-center cursor-ew-resize transition-all select-none",
                "bg-field-raised text-field-text text-xs",
                isDraggingSlider ? "ring-2 ring-field-muted bg-field-canopy" : "hover:bg-field-canopy"
              )}
            >
              <span className="text-[11px] font-mono tracking-tight text-field-muted">
                ||
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Side by side Viewport */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-field-hairline overflow-hidden">
          <div
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className={cn(
              "relative aspect-[4/3] overflow-hidden bg-field-abyss select-none",
              zoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            )}
          >
            <Image
              src={before.url}
              alt={beforeLabel}
              width={800}
              height={600}
              unoptimized
              style={transformStyle}
              className="size-full object-contain pointer-events-none"
            />
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-field-abyss/85 border border-field-hairline text-xs text-field-muted z-10">
              {beforeLabel}
            </div>
          </div>

          <div
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className={cn(
              "relative aspect-[4/3] overflow-hidden bg-field-abyss select-none",
              zoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            )}
          >
            <Image
              src={after.url}
              alt={afterLabel}
              width={800}
              height={600}
              unoptimized
              style={transformStyle}
              className="size-full object-contain pointer-events-none"
            />
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-field-abyss/85 border border-field-hairline text-xs text-field-muted z-10">
              {afterLabel}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Strip for Hashes & Capture Times per §2 */}
      <div className="border-t border-field-hairline">
        <button
          type="button"
          onClick={() => setShowMetadata((prev) => !prev)}
          className="w-full px-3 py-1.5 flex items-center justify-between text-xs text-field-muted hover:text-field-text bg-field-canopy transition-colors"
        >
          <span>Capture metadata &amp; hashes</span>
          {showMetadata ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>

        {showMetadata && (
          <div
            className={cn(
              "grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-t text-xs",
              isPaper ? "border-paper-rule divide-paper-rule" : "border-field-hairline divide-field-hairline"
            )}
          >
            {/* Before Metadata */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-field-text">{beforeLabel}</span>
                <span className="font-mono tabular-nums text-field-muted">
                  {before.capturedAt}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[11px] text-field-muted">SHA-256</span>
                <HashDisplay hash={before.sha256} variant="truncated" theme={theme} />
              </div>
            </div>

            {/* After Metadata */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-field-text">{afterLabel}</span>
                <span className="font-mono tabular-nums text-field-muted">
                  {after.capturedAt}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[11px] text-field-muted">SHA-256</span>
                <HashDisplay hash={after.sha256} variant="truncated" theme={theme} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
