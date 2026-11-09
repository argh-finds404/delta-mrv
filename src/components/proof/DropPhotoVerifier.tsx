"use client";

import * as React from "react";
import {
  CheckCircle2,
  FileCheck2,
  HardDrive,
  HelpCircle,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { cn } from "@/src/lib/utils";

export interface EvidenceFileEntry {
  id: string;
  role: "BEFORE" | "AFTER" | "SUPPLEMENT";
  sha256: string;
  name?: string;
}

export interface DropPhotoVerifierProps {
  evidenceFiles: EvidenceFileEntry[];
  theme?: "paper" | "field";
  className?: string;
}

export function DropPhotoVerifier({
  evidenceFiles,
  theme = "paper",
  className,
}: DropPhotoVerifierProps) {
  const isPaper = theme === "paper";
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = React.useState(false);
  const [isHashing, setIsHashing] = React.useState(false);
  const [computedHash, setComputedHash] = React.useState<string | null>(null);
  const [droppedFileName, setDroppedFileName] = React.useState<string | null>(null);
  const [matchedFile, setMatchedFile] = React.useState<EvidenceFileEntry | null>(null);
  const [hasEvaluated, setHasEvaluated] = React.useState(false);

  const handleFile = async (file: File) => {
    setIsHashing(true);
    setDroppedFileName(file.name);
    setMatchedFile(null);
    setComputedHash(null);
    setHasEvaluated(false);

    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setComputedHash(hash);
      const match = evidenceFiles.find(
        (f) => f.sha256.toLowerCase() === hash.toLowerCase(),
      );
      setMatchedFile(match ?? null);
      setHasEvaluated(true);
    } catch {
      setHasEvaluated(true);
    } finally {
      setIsHashing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className,
      )}
    >
      <div className="space-y-1 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium flex items-center gap-2">
            <FileCheck2 className={isPaper ? "size-4 text-paper-seal" : "size-4 text-signal"} />
            <span>Zero-Trust Drop-Photo Verifier</span>
          </h3>
          <span
            className={cn(
              "font-mono text-[11px] px-2 py-0.5 rounded border",
              isPaper
                ? "border-paper-rule text-paper-muted bg-paper"
                : "border-field-hairline text-field-muted bg-field-raised",
            )}
          >
            Client WebCrypto
          </span>
        </div>
        <p
          className={cn(
            "text-xs leading-relaxed max-w-2xl",
            isPaper ? "text-paper-muted" : "text-field-muted",
          )}
        >
          Do not take Delta’s word for it. Drag and drop any original photograph from your camera or
          field device to verify its cryptographic integrity.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center space-y-2 print:hidden",
          isDragging
            ? isPaper
              ? "border-paper-seal bg-paper-seal/5"
              : "border-signal bg-signal/10"
            : isPaper
              ? "border-paper-rule hover:border-paper-muted bg-paper/50 hover:bg-paper"
              : "border-field-hairline hover:border-field-inert bg-field-raised/50 hover:bg-field-raised",
        )}
      >
        <div
          className={cn(
            "size-10 rounded-full flex items-center justify-center border",
            isPaper
              ? "bg-paper-card border-paper-rule text-paper-muted"
              : "bg-field-canopy border-field-hairline text-field-muted",
          )}
        >
          <Upload className="size-5" />
        </div>
        <div>
          <span className="text-xs font-medium block">
            {isDragging ? "Drop original photograph now" : "Drop original photograph here, or browse"}
          </span>
          <span
            className={cn("text-[11px] block pt-0.5", isPaper ? "text-paper-muted" : "text-field-muted")}
          >
            Raw JPEG, PNG or WebP · Evaluated directly on your device
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />

      {/* Real-time Verification Output */}
      {isHashing && (
        <div className="mt-4 flex items-center gap-2 text-xs font-mono text-signal animate-pulse">
          <HardDrive className="size-4" />
          <span>Computing SHA-256 digest on local device…</span>
        </div>
      )}

      {hasEvaluated && computedHash && (
        <div className="mt-4 space-y-3 pt-4 border-t border-dashed border-paper-rule">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className={isPaper ? "text-paper-muted" : "text-field-muted"}>
              Inspected file: <strong className="text-current font-sans">{droppedFileName}</strong>
            </span>
          </div>

          <div className="space-y-1">
            <span
              className={cn(
                "text-[11px] block",
                isPaper ? "text-paper-muted" : "text-field-muted",
              )}
            >
              Device-computed SHA-256:
            </span>
            <HashDisplay
              hash={computedHash}
              variant="full"
              theme={theme}
              label="SHA-256"
            />
          </div>

          {/* Verdict Banner */}
          {matchedFile ? (
            <div
              className={cn(
                "rounded-lg border p-4 space-y-2",
                isPaper
                  ? "border-paper-seal/40 bg-paper-seal/10 text-paper-seal"
                  : "border-verified/40 bg-verified/10 text-verified",
              )}
            >
              <div className="flex items-center gap-2 font-medium text-xs">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  Byte-Identical Verification Match ({matchedFile.role} Evidence Photograph)
                </span>
              </div>
              <p className="text-[12px] opacity-90 leading-relaxed">
                The dropped photograph matches the anchored record byte-for-byte (Evidence File ID:{" "}
                <code className="font-mono text-[11px]">{matchedFile.id}</code>). Not a single pixel,
                metadata header, or compression block has been altered since intake.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-lg border p-4 space-y-2",
                isPaper
                  ? "border-[#E8A33D]/40 bg-[#E8A33D]/10 text-[#9A6014]"
                  : "border-review/40 bg-review/10 text-review",
              )}
            >
              <div className="flex items-center gap-2 font-medium text-xs">
                <ShieldAlert className="size-4 shrink-0" />
                <span>Hash Mismatch: File Does Not Match Anchored Records</span>
              </div>
              <p className="text-[12px] opacity-90 leading-relaxed">
                This photograph&apos;s SHA-256 hash does not match any evidence file recorded in this
                dossier. Any social media re-compression, cropping, or metadata stripping produces a
                completely different hash. Ensure you drop the unedited camera original.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Permanent Privacy & Client-Side Notice */}
      <div
        className={cn(
          "mt-4 flex items-start gap-2 text-[11px] leading-relaxed pt-3 border-t",
          isPaper
            ? "border-paper-rule text-paper-muted"
            : "border-field-hairline text-field-muted",
        )}
      >
        <HelpCircle className="size-3.5 shrink-0 mt-0.5 text-current opacity-70" />
        <span>
          <strong>Privacy commitment:</strong> The dropped photograph never leaves your browser.
          WebCrypto computes the SHA-256 hash inside your browser memory; zero bytes are transmitted
          over the network.
        </span>
      </div>
    </div>
  );
}
