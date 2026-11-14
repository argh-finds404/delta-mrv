"use client";

import * as React from "react";
import { Compass, MapPin } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface BoundaryPlotProps {
  gps?: { lat: number; lng: number };
  insideBoundary: boolean;
  distanceMeters?: number;
  toleranceMeters?: number;
  cameraModel?: string;
  className?: string;
}

export function BoundaryPlot({
  gps,
  insideBoundary,
  distanceMeters = 0,
  toleranceMeters = 15,
  cameraModel,
  className,
}: BoundaryPlotProps) {
  const isOutside = !insideBoundary;
  const isWithinTolerance = isOutside && distanceMeters <= toleranceMeters;

  // Visual layout for plot diagram: polygon in centre, pin placed inside or offset
  const polygonPts = "60,40 280,30 310,120 90,130";
  const pinPos = insideBoundary
    ? { x: 180, y: 80 }
    : { x: 345, y: 75 }; // offset to the right outside boundary
  const nearestEdgePt = { x: 295, y: 75 };

  return (
    <div className={cn("rounded-lg border border-field-hairline bg-field-abyss p-3 space-y-3", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-field-text">
          <Compass className="size-3.5 text-signal" aria-hidden="true" />
          <span>Geofence Boundary Containment</span>
        </span>
        <span
          className={cn(
            "rounded-sm border px-2 py-0.5 text-[11px] font-mono leading-none",
            insideBoundary
              ? "border-[color-mix(in_srgb,var(--verified)_35%,transparent)] bg-[color-mix(in_srgb,var(--verified)_14%,transparent)] text-verified"
              : isWithinTolerance
              ? "border-[color-mix(in_srgb,var(--review)_35%,transparent)] bg-[color-mix(in_srgb,var(--review)_14%,transparent)] text-review"
              : "border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] text-fraud",
          )}
        >
          {insideBoundary
            ? "Inside boundary"
            : isWithinTolerance
            ? `${distanceMeters.toFixed(1)}m outside (within tolerance)`
            : `${distanceMeters.toFixed(1)}m outside boundary`}
        </span>
      </div>

      <div className="relative aspect-[5/2] w-full overflow-hidden rounded-md border border-field-hairline bg-field-canopy/60">
        <svg
          viewBox="0 0 400 160"
          className="h-full w-full select-none"
          role="img"
          aria-label="Boundary containment plot diagram"
        >
          <defs>
            <pattern id="boundary-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-field-hairline/40" />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#boundary-grid)" />

          <polygon
            points={polygonPts}
            className="fill-verified/10 stroke-verified/60"
            strokeWidth="2"
            strokeDasharray="none"
          />

          <text
            x="170"
            y="48"
            className="fill-field-muted font-mono text-[9px] uppercase tracking-wider select-none"
          >
            Registered Plot Area
          </text>

          {isOutside && (
            <>
              <line
                x1={nearestEdgePt.x}
                y1={nearestEdgePt.y}
                x2={pinPos.x}
                y2={pinPos.y}
                className="stroke-fraud"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={(nearestEdgePt.x + pinPos.x) / 2}
                y={pinPos.y - 8}
                textAnchor="middle"
                className="fill-fraud font-mono text-[9px] font-semibold"
              >
                +{distanceMeters.toFixed(1)} m
              </text>
            </>
          )}

          <g transform={`translate(${pinPos.x}, ${pinPos.y})`}>
            {insideBoundary ? (
              <>
                <circle r="8" className="fill-verified/20" />
                <circle r="4" className="fill-verified" />
                <circle r="1.5" className="fill-field-abyss" />
              </>
            ) : (
              <>
                <circle r="9" className="fill-fraud/20" />
                <circle r="5" className="fill-fraud" />
                <circle r="2" className="fill-field-abyss" />
              </>
            )}
          </g>
          <text
            x={pinPos.x}
            y={pinPos.y + 16}
            textAnchor="middle"
            className={cn(
              "font-mono text-[9px] font-medium",
              insideBoundary ? "fill-field-text" : "fill-fraud",
            )}
          >
            EXIF GPS
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-field-hairline">
        <div className="space-y-0.5">
          <span className="text-field-muted block">EXIF coordinates:</span>
          <span className="font-mono text-field-text flex items-center gap-1">
            <MapPin className="size-3 text-signal shrink-0" />
            {gps ? (
              <span>
                {Math.abs(gps.lat).toFixed(4)}° {gps.lat >= 0 ? "N" : "S"},{" "}
                {Math.abs(gps.lng).toFixed(4)}° {gps.lng >= 0 ? "E" : "W"}
              </span>
            ) : (
              <span className="text-field-muted">No EXIF coordinates recorded</span>
            )}
          </span>
        </div>

        <div className="space-y-0.5">
          <span className="text-field-muted block">Sensor hardware:</span>
          <span className="text-field-text truncate block">
            {cameraModel || "Embedded sensor (unspecified)"}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-field-muted italic">
        EXIF coordinates are reported by device firmware (weak signal). Server evaluates geofence containment
        via PostGIS <code className="font-mono text-signal">ST_Covers</code> against registered legal boundary.
      </p>
    </div>
  );
}

