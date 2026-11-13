"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Upload } from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { cn } from "@/src/lib/utils";

// /verify (docs/16-AMENDMENTS-v2.md A7): a proof id, a transaction hash, or a dropped file. A
// file is hashed here, in the browser; only its SHA-256 is sent. The answer is a link to a
// proof dossier, or the miss sentence below, exactly as written.

type Match = { submissionId: string; projectTitle: string; status: "APPROVED" | "ANCHORED"; matchedBy: "PROOF_ID" | "FILE_SHA256" | "TRANSACTION" };
type State =
  | { kind: "idle" }
  | { kind: "busy"; what: "hashing" | "searching" }
  | { kind: "found"; matches: Match[] }
  | { kind: "missed" }
  | { kind: "error"; message: string };

const sha256Hex = async (file: File) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function ReverseLookup() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [fileHash, setFileHash] = React.useState<{ name: string; hash: string } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [state, setState] = React.useState<State>({ kind: "idle" });

  const lookup = async (q: string) => {
    setState({ kind: "busy", what: "searching" });
    try {
      const res = await fetch(`/api/v1/proofs/lookup?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as { matches?: Match[]; error?: string } | null;
      if (!res.ok) return setState({ kind: "error", message: body?.error ?? "The lookup is unavailable right now. Try again shortly." });
      setState(body?.matches?.length ? { kind: "found", matches: body.matches } : { kind: "missed" });
    } catch {
      setState({ kind: "error", message: "The lookup is unavailable right now. Try again shortly." });
    }
  };

  const checkFile = async (file: File) => {
    setState({ kind: "busy", what: "hashing" });
    const hash = await sha256Hex(file);
    setFileHash({ name: file.name, hash });
    setQuery(hash);
    await lookup(hash);
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            setFileHash(null);
            void lookup(query);
          }
        }}
        className="space-y-3"
      >
        <label htmlFor="verify-query" className="block text-[15px] font-medium">
          Proof id, transaction hash, or a file&apos;s SHA-256
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="verify-query"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 min-w-0 shrink-0 sm:flex-1 rounded-lg border border-paper-rule bg-paper-card px-3.5 font-mono text-[15px] outline-none transition-colors focus-visible:border-paper-ink focus-visible:ring-2 focus-visible:ring-paper-ink/15"
          />
          <button
            type="submit"
            disabled={!query.trim() || state.kind === "busy"}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg border border-paper-ink/15 bg-signal px-5 text-[15px] font-medium text-paper-ink transition-colors hover:bg-[#B9EA5F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink disabled:opacity-50"
          >
            Look up
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      </form>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void checkFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink",
          dragging ? "border-paper-ink bg-paper-card" : "border-paper-rule hover:border-paper-muted",
        )}
      >
        <Upload className="size-6 text-paper-muted" aria-hidden />
        <span className="text-[16px] font-medium">Or drop a photo here</span>
        <span className="max-w-[44ch] text-[14px] leading-[1.5] text-paper-muted">
          It is fingerprinted in this browser. The photo never leaves your device; only its SHA-256 is sent.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-label="Photo to check"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void checkFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div aria-live="polite" className="space-y-4">
        {state.kind === "busy" && (
          <p className="flex items-center gap-2 text-[15px] text-paper-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {state.what === "hashing" ? "Fingerprinting the photo on this device…" : "Looking it up…"}
          </p>
        )}

        {fileHash && state.kind !== "busy" && (
          <div className="space-y-1.5">
            <p className="text-[14px] text-paper-muted">Fingerprint of {fileHash.name}</p>
            <HashDisplay hash={fileHash.hash} variant="full" theme="paper" label="SHA-256" />
          </div>
        )}

        {state.kind === "found" && (
          <ul className="space-y-3">
            {state.matches.map((m) => (
              <li key={m.submissionId} className="rounded-xl border border-paper-seal/40 bg-paper-card p-5">
                <p className="text-[15px] text-paper-muted">
                  {m.matchedBy === "FILE_SHA256" ? "This exact file is part of an approved record" : m.matchedBy === "TRANSACTION" ? "This transaction anchored an approved record" : "This is an approved record"}
                  {m.status === "APPROVED" && " (approved, not anchored on chain yet)"}
                </p>
                <p className="mt-1 font-serif text-[22px] leading-[1.2]">{m.projectTitle}</p>
                <Link
                  href={`/proof/${m.submissionId}`}
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-paper-ink px-4 text-[15px] font-medium text-paper transition-colors hover:bg-paper-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink"
                >
                  Open the proof
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* docs/16-AMENDMENTS-v2.md A7: this sentence, exactly */}
        {state.kind === "missed" && (
          <p className="rounded-xl border border-paper-rule bg-paper-card p-5 text-[16px] leading-[1.55]">
            <strong>No match found.</strong> This file is not in Delta&apos;s anchored records. That does not mean it is fake — it may simply never have been submitted here.
          </p>
        )}

        {state.kind === "error" && (
          <p role="alert" className="rounded-xl border border-paper-rule bg-paper-card p-5 text-[15px]">
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
