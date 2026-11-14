import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface BitGridProps {
  /** 64-character binary string ('0' and '1') or 16-character hex string */
  hash: string;
  /** Optional second hash for comparison mode */
  compareHash?: string;
  /** Explicit precomputed Hamming distance; computed automatically if omitted */
  hammingDistance?: number;
  /** Duplicate detection threshold (default: 10 per docs/10-FORENSICS.md) */
  threshold?: number;
  /** Label for primary hash */
  label?: string;
  /** Label for comparison hash */
  compareLabel?: string;
  /** Size variant for grid cells */
  size?: "sm" | "md" | "lg";
  /** Theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * Normalizes input hash to a 64-character binary string.
 */
function normalizeTo64Bits(raw: string): string {
  if (!raw) return "0".repeat(64);
  const clean = raw.trim();
  // If already 64 chars of 0 and 1:
  if (/^[01]{64}$/.test(clean)) {
    return clean;
  }
  // If hex string (e.g. 16 hex chars = 64 bits):
  if (/^[0-9a-fA-F]+$/.test(clean)) {
    let binary = "";
    for (let i = 0; i < clean.length; i++) {
      const nibble = parseInt(clean[i], 16).toString(2).padStart(4, "0");
      binary += nibble;
    }
    return binary.padEnd(64, "0").slice(0, 64);
  }
  return clean.padEnd(64, "0").slice(0, 64);
}

/**
 * Computes Hamming distance between two 64-bit strings.
 */
function calculateHammingDistance(a: string, b: string): number {
  let dist = 0;
  const len = Math.min(a.length, b.length, 64);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/**
 * BitGrid — 8×8 Matrix Visualizer for 64-bit Perceptual dHash.
 * Renders spatial distribution of image gradient shifts and flags differing bits in comparison mode.
 */
export function BitGrid({
  hash,
  compareHash,
  hammingDistance: explicitDistance,
  threshold = 10,
  label = "dHash (primary)",
  compareLabel = "dHash (comparison)",
  size = "md",
  theme = "field",
  className,
}: BitGridProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const bitsPrimary = React.useMemo(() => normalizeTo64Bits(hash), [hash]);
  const bitsCompare = React.useMemo(
    () => (compareHash ? normalizeTo64Bits(compareHash) : null),
    [compareHash]
  );

  const isComparing = Boolean(bitsCompare);
  const hammingDistance = React.useMemo(() => {
    if (explicitDistance !== undefined) return explicitDistance;
    if (bitsCompare) {
      return calculateHammingDistance(bitsPrimary, bitsCompare);
    }
    return 0;
  }, [explicitDistance, bitsPrimary, bitsCompare]);

  const isDuplicate = isComparing && hammingDistance <= threshold;
  const isPaper = theme === "paper";

  const sizeClasses = {
    sm: "size-3 text-[8px]",
    md: "size-4 text-[9px]",
    lg: "size-6 text-[11px]",
  }[size];

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-xs font-mono select-none",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3 border-inherit">
        <div>
          <span className="font-sans font-medium text-xs block">
            {isComparing ? "dHash Comparison Matrix (8×8)" : "dHash Bit Signature (8×8)"}
          </span>
          <span
            className={cn(
              "text-[11px]",
              isPaper ? "text-paper-muted" : "text-field-muted"
            )}
          >
            {label}
            {isComparing && ` vs ${compareLabel}`}
          </span>
        </div>

        {isComparing && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-mono tabular-nums",
                isDuplicate
                  ? "bg-fraud/15 text-fraud border border-fraud/30"
                  : isPaper
                  ? "bg-paper border border-paper-rule text-paper-muted"
                  : "bg-field-raised border border-field-hairline text-field-text"
              )}
            >
              {isDuplicate ? (
                <>
                  <AlertTriangle className="size-3" />
                  Duplicate (Hamming {hammingDistance} ≤ {threshold})
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3 text-verified" />
                  Distinct (Hamming {hammingDistance} &gt; {threshold})
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* 8×8 Matrix Canvas */}
      <div className="flex justify-center p-1">
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 64 }).map((_, i) => {
            const bitA = bitsPrimary[i] ?? "0";
            const bitB = bitsCompare ? bitsCompare[i] ?? "0" : null;
            const isDiff = isComparing && bitA !== bitB;
            const isHovered = hoveredIndex === i;

            const row = Math.floor(i / 8);
            const col = i % 8;

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                title={`Bit #${i} [Row ${row}, Col ${col}]${
                  isComparing ? ` | A=${bitA}, B=${bitB} ${isDiff ? "(DIFF)" : "(MATCH)"}` : ` = ${bitA}`
                }`}
                className={cn(
                  "flex items-center justify-center font-mono tabular-nums rounded-[2px] transition-colors cursor-crosshair border",
                  sizeClasses,
                  isDiff
                    ? "bg-fraud/20 border-fraud text-fraud font-bold"
                    : bitA === "1"
                    ? isPaper
                      ? "bg-[#1B1D1A]/10 border-paper-rule text-paper-ink"
                      : "bg-field-raised border-field-hairline text-field-text font-semibold"
                    : isPaper
                    ? "bg-paper border-paper-rule/40 text-paper-muted/50"
                    : "bg-field-abyss border-field-hairline/40 text-field-inert/50",
                  isHovered && "ring-1 ring-signal"
                )}
              >
                {bitA}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "mt-3 flex items-center justify-between border-t pt-2 text-[11px] font-mono tabular-nums border-inherit",
          isPaper ? "text-paper-muted" : "text-field-muted"
        )}
      >
        <span>
          {hoveredIndex !== null
            ? `Bit #${hoveredIndex} (Row ${Math.floor(hoveredIndex / 8)}, Col ${hoveredIndex % 8})`
            : "Hover cell to inspect coordinates"}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "inline-block size-2 rounded-xs border",
                isPaper ? "bg-paper border-paper-rule" : "bg-field-abyss border-field-hairline"
              )}
            />
            0
          </span>
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "inline-block size-2 rounded-xs border",
                isPaper ? "bg-[#1B1D1A]/10 border-paper-rule" : "bg-field-raised border-field-hairline"
              )}
            />
            1
          </span>
          {isComparing && (
            <span className="flex items-center gap-1 text-fraud font-medium">
              <span className="inline-block size-2 rounded-xs bg-fraud/40 border border-fraud" />
              diff
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

