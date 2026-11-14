"use client";

import * as React from "react";
import { CloudOff, FileJson, RefreshCw } from "lucide-react";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { CurveLoader } from "@/src/components/motion/CurveLoader";
import { DrawnIcon } from "@/src/components/motion/DrawnIcon";
import { DropPhotoVerifier } from "@/src/components/proof/DropPhotoVerifier";
import { REGISTRY_ABI } from "@/src/lib/chain/registry";
import { BUNDLE_EXTENSION, chainStep, verifyBundleOffline, type BundleStep, type ProofBundle } from "@/src/lib/proof-bundle";
import { cn } from "@/src/lib/utils";

const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const REGISTRY = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null;

const TONE = { pass: "text-paper-seal", fail: "text-fraud", skip: "text-paper-muted", unavailable: "text-review" } as const;
const WORD = { pass: "Passed", fail: "Failed", skip: "Not applicable", unavailable: "Could not check" } as const;

async function readAnchor(address: `0x${string}`, batchId: bigint) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL, { timeout: 12_000, retryCount: 1 }) });
  return client.readContract({ address, abi: REGISTRY_ABI, functionName: "getAnchor", args: [batchId] });
}

type Result = { name: string; bundle: ProofBundle | null; steps: BundleStep[]; chain: BundleStep | null; checkingChain: boolean };

/**
 * A downloaded proof file (delta.proof-bundle.v1), checked in this browser: nothing is sent to
 * Delta, no database is asked. The file's record is rehashed, its Merkle path climbed, its device
 * signature verified; then, if the network allows, Delta's registry contract is asked directly.
 */
export function BundleVerifier() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const askChain = React.useCallback(async (bundle: ProofBundle) => {
    setResult((r) => r && { ...r, checkingChain: true });
    const step = await chainStep(bundle, { registry: REGISTRY, read: readAnchor });
    setResult((r) => r && { ...r, chain: step, checkingChain: false });
  }, []);

  const check = async (file: File) => {
    setBusy(true);
    try {
      let raw: unknown = null;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        raw = null;
      }
      const out = await verifyBundleOffline(raw);
      const offlineOk = out.bundle !== null && out.steps.every((s) => s.state !== "fail");
      setResult({ name: file.name, bundle: out.bundle, steps: out.steps, chain: null, checkingChain: offlineOk });
      if (out.bundle && offlineOk) void askChain(out.bundle);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const steps = result ? [...result.steps, ...(result.chain ? [result.chain] : [])] : [];
  const failed = steps.some((s) => s.state === "fail");
  const verdict = !result
    ? null
    : failed
      ? { tone: "text-fraud", text: "This file does not check out." }
      : result.checkingChain
        ? { tone: "text-paper-muted", text: "The file checks out offline. Asking the chain…" }
        : result.chain?.state === "pass"
          ? { tone: "text-paper-seal", text: "Checks out, and the root is anchored on chain." }
          : result.chain?.state === "skip"
            ? { tone: "text-paper-seal", text: "Checks out. The record was not anchored when the file was made." }
            : { tone: "text-review", text: "Checks out offline. The chain could not be asked." };

  return (
    <section aria-labelledby="bundle-heading" className="space-y-5">
      <div className="space-y-2">
        <h2 id="bundle-heading" className="type-section">
          Check a proof file
        </h2>
        <p className="max-w-[60ch] text-[16px] leading-[1.6] text-paper-muted">
          A <span className="font-mono text-[14px]">{BUNDLE_EXTENSION}</span> file saved from a proof page, even years ago. Your browser rechecks it on its own: nothing is uploaded, and no Delta
          database is asked.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a proof file to check. It is read on this device and never uploaded."
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void check(f);
        }}
        className={cn(
          "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink",
          dragging ? "border-paper-seal bg-paper-seal/5" : "pattern-dots border-paper-rule bg-paper-card hover:border-paper-muted",
        )}
        data-testid="bundle-drop"
      >
        {busy ? <CurveLoader className="size-7 text-paper-muted" /> : <FileJson className="size-6 text-paper-muted" aria-hidden />}
        <span className="text-[15px] font-medium">{dragging ? "Drop the proof file" : "Drop a proof file here, or choose one"}</span>
        <span className="text-[13px] text-paper-muted">Read on this device only</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void check(f);
        }}
      />

      {result && (
        <div className="space-y-5 rounded-xl border border-paper-rule bg-paper-card p-5 sm:p-6" aria-live="polite" data-testid="bundle-result" data-failed={failed || undefined}>
          {result.bundle && (
            <dl className="grid gap-x-8 gap-y-2 border-b border-paper-rule pb-4 text-[15px] sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-paper-muted">Project</dt>
                <dd>{result.bundle.record.projectTitle}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-paper-muted">Claimed by</dt>
                <dd>{result.bundle.record.ownerOrgName}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-paper-muted">Their claim</dt>
                <dd>{result.bundle.record.claim ?? "No quantity stated"}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-paper-muted">Record</dt>
                <dd className="break-all font-mono text-[13px]">
                  {result.bundle.record.submissionId}
                  {result.bundle.record.checkupOf && <span className="font-sans text-paper-muted"> (a survival check-up)</span>}
                </dd>
              </div>
            </dl>
          )}

          {verdict && (
            <p className={cn("font-serif text-[24px] leading-[1.25]", verdict.tone)} data-testid="bundle-verdict">
              {verdict.text}
            </p>
          )}

          <ol className="space-y-3">
            {steps.map((s, i) => {
              return (
                // results arrive one by one, the way the checks run: file, fingerprint, batch, device, chain
                <li key={s.id} className="step-arrive flex items-start gap-3" style={{ "--i": s.id === "chain" ? 0 : i } as React.CSSProperties} data-step={s.id} data-state={s.state}>
                  {s.state === "unavailable" ? (
                    <CloudOff className={cn("mt-0.5 size-5 shrink-0", TONE[s.state])} aria-hidden />
                  ) : (
                    <DrawnIcon mark={s.state === "pass" ? "check" : s.state === "fail" ? "cross" : "dash"} className={cn("mt-0.5", TONE[s.state])} />
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[15px] font-medium">
                      {s.title} <span className={cn("ml-1 text-[13px] font-normal", TONE[s.state])}>{WORD[s.state]}</span>
                    </p>
                    <p className="text-[14px] leading-[1.55] text-paper-muted">{s.detail}</p>
                  </div>
                </li>
              );
            })}
            {result.checkingChain && (
              <li className="flex items-center gap-3 text-[15px] text-paper-muted">
                <CurveLoader kind="lissajous" />
                Asking Delta&apos;s registry contract on Base Sepolia…
              </li>
            )}
          </ol>

          {result.bundle && result.chain?.state === "unavailable" && (
            <button
              type="button"
              onClick={() => void askChain(result.bundle!)}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-paper-rule px-3.5 text-[14px] transition-colors hover:border-paper-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink sm:h-10"
            >
              <RefreshCw className="size-4" aria-hidden />
              Ask the chain again
            </button>
          )}

          {result.bundle && !failed && (
            <DropPhotoVerifier evidenceFiles={result.bundle.manifest.files.map((f) => ({ id: `${f.role}-${f.round}-${f.sha256}`, role: f.role, round: f.round, sha256: f.sha256 }))} theme="paper" />
          )}
        </div>
      )}
    </section>
  );
}
