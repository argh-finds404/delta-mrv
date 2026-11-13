"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { createPublicClient, http, zeroHash } from "viem";
import { baseSepolia } from "viem/chains";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { VerificationBadge, type VerificationState } from "@/src/components/verification-badge/verification-badge";
import { explorerAddress, leafHash, REGISTRY_ABI } from "@/src/lib/chain/registry";
import { canonicalJson, manifestHash, type Manifest } from "@/src/lib/crypto/manifest";
import { merkleLeaf } from "@/src/lib/crypto/merkle";

// The verification a visitor's own browser does (docs/09-WEB3.md §7, docs/13 D1). Nothing here
// trusts Delta's server beyond the manifest it handed over: the hash is recomputed with the
// same frozen code the server used, the leaf is rebuilt from it, and the contract is asked
// directly, over a public RPC, whether that leaf is in the anchored batch.
//
// A network failure is UNAVAILABLE, never MISMATCH (§8): an unreachable chain says nothing
// about the record.

type Hex = `0x${string}`;

export interface ProofAnchor {
  batchId: number;
  status: "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";
  merkleRoot: string;
  chainId: number;
  contractAddress: string;
  proof: string[];
}

export interface ProofVerifierProps {
  manifest: Manifest;
  anchor: ProofAnchor | null;
}

type Work = { hash: string; leaf: readonly [Hex, Hex, bigint]; leafHash: Hex };
type Verdict = { state: VerificationState; headline: string; detail: string; onChainRoot?: string };

// A public endpoint: eth_call needs no key, so no secret reaches the browser.
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

async function check(manifest: Manifest, anchor: ProofAnchor | null): Promise<{ work: Work; verdict: Verdict }> {
  const hash = await manifestHash(manifest);
  const leaf = merkleLeaf(manifest.submissionId, hash, manifest.approvedAtIso);
  const work: Work = { hash, leaf, leafHash: leafHash(leaf) };

  if (!anchor) {
    return { work, verdict: { state: "PENDING", headline: "Approved, waiting for the next batch", detail: "Two independent reviewers approved this record. Its fingerprint has not been published yet: approved records are anchored together, once a day." } };
  }
  if (anchor.status !== "CONFIRMED") {
    return { work, verdict: { state: "PENDING", headline: `In batch ${anchor.batchId}, not confirmed yet`, detail: "This record's fingerprint is in a batch that has not been confirmed on chain. Nothing has been compared yet." } };
  }

  try {
    const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL, { timeout: 12_000, retryCount: 1 }) });
    const contract = { address: anchor.contractAddress as Hex, abi: REGISTRY_ABI } as const;
    const [held, included] = await Promise.all([
      client.readContract({ ...contract, functionName: "getAnchor", args: [BigInt(anchor.batchId)] }),
      client.readContract({ ...contract, functionName: "verify", args: [BigInt(anchor.batchId), anchor.proof as Hex[], work.leafHash] }),
    ]);
    if (held.merkleRoot === zeroHash) {
      return { work, verdict: { state: "MISMATCH", headline: "The contract holds no such batch", detail: `This page says the record is in batch ${anchor.batchId}, but the contract has nothing anchored under that number.` } };
    }
    if (!included) {
      return { work, verdict: { state: "MISMATCH", headline: "This record differs from what was anchored", detail: "The fingerprint your browser computed from the record below is not in the anchored batch. The record has changed since it was approved, or the proof shown here is not its own.", onChainRoot: held.merkleRoot } };
    }
    return { work, verdict: { state: "MATCH", headline: "Unchanged since it was approved", detail: `Your browser recomputed this record's fingerprint, and the contract confirmed it is in batch ${anchor.batchId}, anchored ${new Date(Number(held.anchoredAt) * 1000).toISOString().slice(0, 10)}.`, onChainRoot: held.merkleRoot } };
  } catch {
    return { work, verdict: { state: "UNAVAILABLE", headline: "The chain could not be reached", detail: "Nothing was compared, so this says nothing about the record. Check your connection and try again." } };
  }
}

const row = "grid gap-1 py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center sm:gap-4";
const term = "text-[14px] text-paper-muted";
const mono = "break-all font-mono text-[13px] leading-[1.6]";

export function ProofVerifier({ manifest, anchor }: ProofVerifierProps) {
  const [result, setResult] = React.useState<{ work: Work; verdict: Verdict } | null>(null);
  const [checking, setChecking] = React.useState(true);

  const run = React.useCallback(async () => {
    setChecking(true);
    try {
      setResult(await check(manifest, anchor));
    } finally {
      setChecking(false);
    }
  }, [manifest, anchor]);

  React.useEffect(() => {
    const t = setTimeout(() => void run(), 0);
    return () => clearTimeout(t);
  }, [run]);

  const verdict = result?.verdict;
  const work = result?.work;
  const cast = work && anchor ? `cast call ${anchor.contractAddress} "verify(uint256,bytes32[],bytes32)(bool)" ${anchor.batchId} "[${anchor.proof.join(",")}]" ${work.leafHash} --rpc-url ${RPC_URL}` : null;

  return (
    <div className="space-y-5">
      {/* the verdict */}
      <div className="rounded-xl border border-paper-rule bg-paper-card p-5 sm:p-6" aria-live="polite" aria-busy={checking}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {verdict ? <VerificationBadge state={verdict.state} theme="paper" /> : <span className="text-[14px] text-paper-muted">Checking in your browser…</span>}
            <p data-testid="proof-verdict" data-state={verdict?.state ?? "CHECKING"} className="font-serif text-[26px] leading-[1.2] tracking-[-0.01em]">
              {verdict?.headline ?? "Recomputing this record's fingerprint"}
            </p>
            <p className="max-w-[62ch] text-[15px] leading-[1.6] text-paper-muted">{verdict?.detail ?? "Your browser is hashing the record and asking the contract about it. Nothing is taken on Delta's word."}</p>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={checking}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-paper-rule px-3.5 text-[14px] transition-colors hover:border-paper-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink disabled:opacity-60 print:hidden"
          >
            <RefreshCw className={checking ? "size-4 motion-safe:animate-spin" : "size-4"} aria-hidden />
            Check again
          </button>
        </div>
      </div>

      {/* the work, so a visitor who does not trust this page can redo every step */}
      {work && (
        <details className="group rounded-xl border border-paper-rule">
          <summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-paper-rule underline-offset-[5px] group-open:decoration-paper-ink">Show the work</span>
            <span className="ml-2 font-normal text-paper-muted">what was hashed, and what the contract was asked</span>
          </summary>
          <div className="space-y-6 border-t border-paper-rule px-5 py-5">
            <div className="space-y-2">
              <h3 className="text-[15px] font-medium">1. The record, in canonical form</h3>
              <p className={term}>RFC 8785 JSON: the exact bytes that are hashed. Any change to any value changes the fingerprint.</p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-paper-rule bg-paper p-3 font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-all">{canonicalJson(manifest)}</pre>
            </div>

            <div className="space-y-2">
              <h3 className="text-[15px] font-medium">2. Its fingerprint</h3>
              <p className={term}>SHA-256 of those bytes, computed in this browser.</p>
              <HashDisplay hash={work.hash} variant="full" theme="paper" label="Manifest SHA-256" />
            </div>

            <div className="space-y-2">
              <h3 className="text-[15px] font-medium">3. The leaf</h3>
              <p className={term}>The record&apos;s id, its fingerprint and the second it was approved, encoded and hashed twice with keccak-256.</p>
              <dl className="divide-y divide-paper-rule border-y border-paper-rule">
                {(
                  [
                    ["Record id", work.leaf[0]],
                    ["Fingerprint", work.leaf[1]],
                    ["Approved at", `${work.leaf[2]} (${manifest.approvedAtIso})`],
                    ["Leaf hash", work.leafHash],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className={row}>
                    <dt className={term}>{k}</dt>
                    <dd className={mono}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {anchor && (
              <div className="space-y-2">
                <h3 className="text-[15px] font-medium">4. The question put to the contract</h3>
                <p className={term}>
                  Is this leaf in batch {anchor.batchId}?{" "}
                  {anchor.proof.length ? `The proof path is the ${anchor.proof.length === 1 ? "one hash" : `${anchor.proof.length} hashes`} needed to climb from the leaf to the batch's root.` : "The batch holds this one record, so no proof path is needed."}
                </p>
                <dl className="divide-y divide-paper-rule border-y border-paper-rule">
                  <div className={row}>
                    <dt className={term}>Contract</dt>
                    <dd className={mono}>
                      <a href={explorerAddress(anchor.contractAddress)} target="_blank" rel="noreferrer" className="underline decoration-paper-rule underline-offset-4 hover:decoration-paper-ink">
                        {anchor.contractAddress}
                      </a>
                    </dd>
                  </div>
                  <div className={row}>
                    <dt className={term}>Root on record</dt>
                    <dd className={mono}>{anchor.merkleRoot}</dd>
                  </div>
                  {verdict?.onChainRoot && (
                    <div className={row}>
                      <dt className={term}>Root on chain</dt>
                      <dd className={mono}>{verdict.onChainRoot}</dd>
                    </div>
                  )}
                  <div className={row}>
                    <dt className={term}>Proof path</dt>
                    <dd className={mono}>
                      {anchor.proof.length ? (
                        <ol className="space-y-1">
                          {anchor.proof.map((p, i) => (
                            <li key={p}>
                              <span className="mr-2 text-paper-muted">{i + 1}</span>
                              {p}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        "Empty: this record is the batch's only leaf, so its leaf hash is the root."
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {cast && (
              <div className="space-y-2">
                <h3 className="text-[15px] font-medium">Do it yourself</h3>
                <p className={term}>With Foundry installed, this asks the contract the same question from a terminal. It answers true or false.</p>
                <pre className="overflow-auto rounded-lg border border-paper-rule bg-paper p-3 font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-all">{cast}</pre>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
