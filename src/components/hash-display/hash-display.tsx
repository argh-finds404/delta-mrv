"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface HashDisplayProps {
  /** Full cryptographic hash (e.g. 64-char SHA-256 or Merkle root) */
  hash: string;
  /**
   * full: shows all characters with subtle 8-character spacing
   * truncated: shows first 8 + ellipsis + last 8
   */
  variant?: "full" | "truncated";
  /** Optional prefix label (e.g. 'sha256', 'root', 'leaf') */
  label?: string;
  /** Whether to show the copy button (default: true) */
  showCopy?: boolean;
  /** Optional theme override */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * Truncates a hash strictly to 8 chars ... 8 chars per docs/06-DESIGN-SYSTEM.md §3.2
 */
export function formatTruncatedHash(hash: string): string {
  if (!hash) return "";
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

/**
 * Groups full hash into 8-character chunks for human readability
 */
export function formatGroupedHash(hash: string): string {
  if (!hash) return "";
  const chunks = hash.match(/.{1,8}/g);
  return chunks ? chunks.join(" ") : hash;
}

/**
 * HashDisplay — Instrument-grade cryptographic hash visualizer.
 * Enforces monospace typography, tabular numerals, and zero layout shift.
 */
export function HashDisplay({
  hash,
  variant = "full",
  label,
  showCopy = true,
  theme = "field",
  className,
}: HashDisplayProps) {
  const [copied, setCopied] = React.useState(false);

  const displayString =
    variant === "truncated" ? formatTruncatedHash(hash) : formatGroupedHash(hash);

  const handleCopy = React.useCallback(async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    } catch {
      // Fallback if clipboard API restricted
    }
  }, [hash]);

  const isPaper = theme === "paper";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded border px-2 py-1 text-xs",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
      title={hash}
    >
      {label && (
        <span
          className={cn(
            "font-sans font-normal uppercase tracking-wider text-[11px]",
            isPaper ? "text-paper-muted" : "text-field-muted"
          )}
        >
          {label}
        </span>
      )}

      <code className="font-mono tabular-nums tracking-wide select-all text-xs">
        {displayString}
      </code>

      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Hash copied to clipboard" : "Copy full hash"}
          className={cn(
            "ml-1 inline-flex size-5 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal",
            isPaper
              ? "text-paper-muted hover:bg-paper hover:text-paper-ink"
              : "text-field-muted hover:bg-field-raised hover:text-field-text"
          )}
        >
          {copied ? (
            <Check className="size-3.5 text-verified" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

