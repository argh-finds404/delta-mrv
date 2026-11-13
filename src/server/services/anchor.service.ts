import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, ne, notExists, sql } from "drizzle-orm";
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, WaitForTransactionReceiptTimeoutError, zeroHash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { requireEnv } from "../../env";
import { BASE_SEPOLIA_CHAIN_ID, REGISTRY_ABI } from "../../lib/chain/registry";
import { manifestHash, type Manifest } from "../../lib/crypto/manifest";
import { buildMerkleTree, merkleLeaf } from "../../lib/crypto/merkle";
import { canRunAnchoring } from "../../lib/org-type";
import { assertTransition } from "../../lib/state-machine";
import { ChainUnavailable, type ChainPort } from "../chain/port";
import { db } from "../db/client";
import { anchorBatch, anchorLeaf, evidenceSubmission } from "../db/schema";
import { actorContext, type Actor, type Executor } from "./access";
import { appendAuditEvent } from "./audit-chain.service";
import { ForbiddenError } from "./errors";

// Merkle batching and anchoring (docs/09-WEB3.md §4 to §6, docs/13-FEATURE-SPEC.md D3).
//
// One run: batch every approved record that has a sealed manifest and no leaf yet, write the
// batch and its proofs to the database, and only then send the root. A batch moves
// PENDING -> SUBMITTED -> CONFIRMED, or to FAILED. Submissions move to ANCHORED only when the
// chain holds their root; until then, and after any failure, they stay APPROVED.
//
// Leaves are append-only and unique per (submission, manifest version), so a failed batch is
// never rebuilt: the next run sends the same batch again under the same id.

type Hex = `0x${string}`;
type BatchRow = typeof anchorBatch.$inferSelect;

/** A claim with no transaction this old was abandoned mid-flight, and is sent again. */
const ABANDONED_AFTER_MS = 10 * 60 * 1000;

/**
 * The viem adapter. This file is the only one that reads the anchor key, and the signer it
 * builds never leaves this closure (docs/09-WEB3.md §6). Always Base Sepolia's chain id: a local
 * anvil chain for tests runs under the same id.
 */
export function viemChain(cfg: { rpcUrl: string; contractAddress: Hex; receiptTimeoutMs?: number } & ({ privateKey: Hex } | { unlockedAccount: Hex })): ChainPort {
  const transport = http(cfg.rpcUrl);
  // an unlocked account is one the node itself signs for: a development chain's own, never a hosted RPC's
  const account = "privateKey" in cfg ? privateKeyToAccount(cfg.privateKey) : cfg.unlockedAccount;
  const reader = createPublicClient({ chain: baseSepolia, transport });
  const signer = createWalletClient({ account, chain: baseSepolia, transport });
  const contract = { address: cfg.contractAddress, abi: REGISTRY_ABI } as const;
  return {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    contractAddress: cfg.contractAddress,
    async anchoredRoot(batchId) {
      const anchor = await reader.readContract({ ...contract, functionName: "getAnchor", args: [batchId] });
      return anchor.merkleRoot === zeroHash ? null : anchor.merkleRoot;
    },
    async sendAnchor(batchId, merkleRoot, leafCount) {
      const { request } = await reader.simulateContract({ ...contract, account, functionName: "anchorBatch", args: [batchId, merkleRoot, leafCount] });
      return signer.writeContract(request);
    },
    async receipt(txHash) {
      try {
        const r = await reader.waitForTransactionReceipt({ hash: txHash, timeout: cfg.receiptTimeoutMs ?? 45_000 });
        return { ok: r.status === "success", blockNumber: r.blockNumber };
      } catch (e) {
        if (e instanceof WaitForTransactionReceiptTimeoutError) return null;
        throw e;
      }
    },
  };
}

function configuredChain(): ChainPort {
  try {
    const target = { rpcUrl: requireEnv("BASE_SEPOLIA_RPC_URL"), contractAddress: requireEnv("ANCHOR_CONTRACT_ADDRESS") as Hex };
    // pnpm dev:local: a local anvil node signs with its own unlocked account, so no key exists to hold.
    // Never in a production build, where the anchor key is the only signer.
    const local = process.env.NODE_ENV === "production" ? undefined : process.env.LOCAL_CHAIN_ANCHORER;
    if (local && /^0x[0-9a-fA-F]{40}$/.test(local)) return viemChain({ ...target, unlockedAccount: local as Hex });
    return viemChain({ ...target, privateKey: requireEnv("ANCHOR_PRIVATE_KEY") as Hex });
  } catch (e) {
    // requireEnv names the variable and never its value
    throw new ChainUnavailable((e as Error).message);
  }
}

/** One line: the contract's own error name when it refused, else viem's summary. It never contains the key. */
function reasonOf(e: unknown): string {
  if (!(e instanceof BaseError)) return e instanceof Error ? e.message : String(e);
  const revert = e.walk((cause) => cause instanceof ContractFunctionRevertedError);
  const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
  return name ? `the contract refused: ${name}` : e.shortMessage;
}

const eligible = (x: Executor) =>
  and(
    eq(evidenceSubmission.status, "APPROVED"),
    isNotNull(evidenceSubmission.manifestHash),
    notExists(
      x
        .select({ one: sql`1` })
        .from(anchorLeaf)
        .where(and(eq(anchorLeaf.submissionId, evidenceSubmission.id), eq(anchorLeaf.manifestVersion, evidenceSubmission.manifestVersion))),
    ),
  );

/**
 * Batches what is waiting: the tree, the batch row and every leaf with its proof, in one
 * transaction, before anything is sent. A record whose stored manifest no longer hashes to its
 * recorded hash is refused, never anchored.
 */
async function createBatch(x: Executor, chain: ChainPort, scope: { only?: string[]; approvedBefore?: Date }): Promise<{ batch: BatchRow | null; refused: string[] }> {
  return x.transaction(async (tx) => {
    // one batch is built at a time, so two runs cannot batch the same record
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('anchor:batch'))`);
    const rows = await tx
      .select({ id: evidenceSubmission.id, manifest: evidenceSubmission.manifest, manifestHash: evidenceSubmission.manifestHash, manifestVersion: evidenceSubmission.manifestVersion })
      .from(evidenceSubmission)
      .where(
        and(
          eligible(tx),
          scope.only ? inArray(evidenceSubmission.id, scope.only) : undefined,
          // ISO 8601 UTC with milliseconds and Z, by the frozen manifest contract, so text order is time order
          scope.approvedBefore ? sql`${evidenceSubmission.manifest}->>'approvedAtIso' < ${scope.approvedBefore.toISOString()}` : undefined,
        ),
      )
      .orderBy(asc(evidenceSubmission.id));

    const refused: string[] = [];
    const sound: { id: string; manifestHash: string; manifestVersion: number; approvedAtIso: string }[] = [];
    for (const r of rows) {
      const manifest = r.manifest as Manifest | null;
      if (manifest && (await manifestHash(manifest)) === r.manifestHash) sound.push({ id: r.id, manifestHash: r.manifestHash!, manifestVersion: r.manifestVersion, approvedAtIso: manifest.approvedAtIso });
      else refused.push(r.id);
    }
    if (!sound.length) return { batch: null, refused };

    // ascending submission id, the order the frozen leaf layout fixes; `sound` is already in it
    const leaves = sound.map((s) => merkleLeaf(s.id, s.manifestHash, s.approvedAtIso));
    const tree = buildMerkleTree(leaves);
    const [batch] = await tx
      .insert(anchorBatch)
      .values({ merkleRoot: tree.root, chainId: chain.chainId, contractAddress: chain.contractAddress, leafCount: sound.length })
      .returning();
    const leafRows = sound.map((s, i) => ({
      batchId: batch!.id,
      submissionId: s.id,
      manifestHash: s.manifestHash,
      manifestVersion: s.manifestVersion,
      leafIndex: i,
      proof: tree.getProof(leaves[i]!),
    }));
    for (let i = 0; i < leafRows.length; i += 1000) await tx.insert(anchorLeaf).values(leafRows.slice(i, i + 1000));
    return { batch: batch!, refused };
  });
}

export type BatchOutcome = { batchId: number; status: BatchRow["status"]; leafCount: number; txHash: string | null; error: string | null };
const outcome = (b: BatchRow, status: BatchRow["status"], txHash: string | null = b.txHash, error: string | null = null): BatchOutcome => ({ batchId: b.id, status, leafCount: b.leafCount, txHash, error });

/** The chain holds this batch's root: mark it, move its records to ANCHORED, and say so on each owner's audit chain. */
async function confirm(x: Executor, b: BatchRow, txHash: string | null, blockNumber: bigint | null, actorUserId: string | null): Promise<BatchOutcome> {
  await x.transaction(async (tx) => {
    const [won] = await tx
      .update(anchorBatch)
      .set({ status: "CONFIRMED", txHash, blockNumber: blockNumber === null ? null : Number(blockNumber), confirmedAt: new Date() })
      .where(and(eq(anchorBatch.id, b.id), ne(anchorBatch.status, "CONFIRMED")))
      .returning({ id: anchorBatch.id });
    if (!won) return; // another run confirmed it first

    assertTransition("APPROVED", "ANCHORED");
    const moved = await tx
      .update(evidenceSubmission)
      .set({ status: "ANCHORED" })
      .where(
        and(
          eq(evidenceSubmission.status, "APPROVED"),
          inArray(evidenceSubmission.id, tx.select({ id: anchorLeaf.submissionId }).from(anchorLeaf).where(eq(anchorLeaf.batchId, b.id))),
        ),
      )
      .returning({ id: evidenceSubmission.id, ownerOrgId: evidenceSubmission.ownerOrgId });

    for (const orgId of [...new Set(moved.map((m) => m.ownerOrgId))].sort()) {
      const submissionIds = moved.filter((m) => m.ownerOrgId === orgId).map((m) => m.id).sort();
      await appendAuditEvent(tx, {
        orgId,
        eventType: "ANCHOR_CONFIRMED",
        actorUserId,
        payload: { batchId: b.id, merkleRoot: b.merkleRoot, chainId: b.chainId, contractAddress: b.contractAddress, txHash, submissionIds },
      });
    }
  });
  return outcome(b, "CONFIRMED", txHash);
}

async function fail(x: Executor, b: BatchRow, error: string): Promise<BatchOutcome> {
  // never over a confirmation; the records were never moved, so they are still APPROVED
  await x.update(anchorBatch).set({ status: "FAILED" }).where(and(eq(anchorBatch.id, b.id), ne(anchorBatch.status, "CONFIRMED")));
  console.error(`anchor batch ${b.id} failed: ${error}`);
  return outcome(b, "FAILED", b.txHash, error);
}

/** Moves one unfinished batch as far as the chain allows. The chain's own state is the authority. */
async function advance(x: Executor, chain: ChainPort, b: BatchRow, actorUserId: string | null): Promise<BatchOutcome> {
  const id = BigInt(b.id);
  const settle = async (txHash: Hex): Promise<BatchOutcome> => {
    const r = await chain.receipt(txHash);
    if (!r) return outcome(b, "SUBMITTED", txHash);
    return r.ok ? confirm(x, b, txHash, r.blockNumber, actorUserId) : fail(x, { ...b, txHash }, "the transaction reverted");
  };

  try {
    const held = await chain.anchoredRoot(id);
    if (held) {
      if (held.toLowerCase() !== b.merkleRoot.toLowerCase()) return await fail(x, b, "the contract already holds another root under this batch id");
      // it landed, perhaps in a run that died before recording it: the block comes from the receipt if we know the transaction
      const r = b.txHash ? await chain.receipt(b.txHash as Hex) : null;
      return await confirm(x, b, b.txHash, r?.blockNumber ?? null, actorUserId);
    }

    if (b.status === "SUBMITTED") {
      if (b.txHash) return await settle(b.txHash as Hex);
      // claimed by a run that is, as far as we know, still sending it
      if (Date.now() - b.createdAt.getTime() < ABANDONED_AFTER_MS) return outcome(b, "SUBMITTED");
    }

    // PENDING, FAILED, or an abandoned claim: claim it, so two runs never send the same batch
    const [claimed] = await x
      .update(anchorBatch)
      .set({ status: "SUBMITTED", txHash: null })
      .where(and(eq(anchorBatch.id, b.id), eq(anchorBatch.status, b.status)))
      .returning({ id: anchorBatch.id });
    if (!claimed) return outcome(b, b.status);

    const txHash = await chain.sendAnchor(id, b.merkleRoot as Hex, b.leafCount);
    await x.update(anchorBatch).set({ txHash }).where(eq(anchorBatch.id, b.id));
    return await settle(txHash);
  } catch (e) {
    return fail(x, b, reasonOf(e));
  }
}

export type AnchorRun = {
  /** The batch this run created, if anything was waiting. */
  created: { batchId: number; leafCount: number } | null;
  /** Records whose stored manifest no longer matches its hash: never anchored, to be investigated. */
  refused: string[];
  /** Every unfinished batch this run touched, oldest first. */
  batches: BatchOutcome[];
};

/**
 * One anchoring run, as the daily cron and "Anchor now" both make it. Safe to call at any time
 * and from two places at once. Throws ChainUnavailable when this server has no chain configured.
 * `only` narrows what is batched to the given records (a test anchors its own rows on a shared database);
 * `approvedBefore` to records approved before a cutoff (a daily batch that closes at a fixed hour).
 */
export async function anchorPending(opts: { actorUserId?: string | null; only?: string[]; approvedBefore?: Date } = {}, x: Executor = db, chain: ChainPort = configuredChain()): Promise<AnchorRun> {
  const { batch, refused } = await createBatch(x, chain, opts);
  if (refused.length) console.error(`anchoring refused ${refused.length} record(s) whose manifest does not match its hash: ${refused.join(", ")}`);

  const open = await x
    .select()
    .from(anchorBatch)
    .where(and(ne(anchorBatch.status, "CONFIRMED"), eq(anchorBatch.chainId, chain.chainId), sql`lower(${anchorBatch.contractAddress}) = ${chain.contractAddress.toLowerCase()}`))
    .orderBy(asc(anchorBatch.id));
  const batches: BatchOutcome[] = [];
  for (const b of open) batches.push(await advance(x, chain, b, opts.actorUserId ?? null));
  return { created: batch ? { batchId: batch.id, leafCount: batch.leafCount } : null, refused, batches };
}

/** Who may press "Anchor now" and read the batch table: see canRunAnchoring. Memberships are read fresh. */
async function assertAnchorAdmin(x: Executor, actor: Actor): Promise<void> {
  const { memberships } = await actorContext(x, actor);
  if (!canRunAnchoring(memberships)) throw new ForbiddenError("only an admin of a verifier organisation may run anchoring");
}

export async function anchorNow(actor: Actor, x: Executor = db, chain?: ChainPort): Promise<AnchorRun> {
  await assertAnchorAdmin(x, actor);
  return anchorPending({ actorUserId: actor.userId }, x, chain ?? configuredChain());
}

/** Whether any batch has ever been confirmed on chain: what the landing page's last two steps rest on. */
export async function hasConfirmedAnchor(x: Executor = db): Promise<boolean> {
  const [row] = await x.select({ id: anchorBatch.id }).from(anchorBatch).where(eq(anchorBatch.status, "CONFIRMED")).limit(1);
  return Boolean(row);
}

export type AnchorOverview = {
  /** Approved, sealed and not yet in any batch. */
  waiting: number;
  /** Approved before manifests were sealed, or with no files: they can never be anchored. */
  unsealed: number;
  configured: boolean;
  batches: (Pick<BatchRow, "id" | "status" | "leafCount" | "merkleRoot" | "txHash" | "blockNumber" | "contractAddress" | "createdAt" | "confirmedAt">)[];
};

/** What the admin anchor panel shows. Counts and public values only. */
export async function anchorOverview(actor: Actor, x: Executor = db): Promise<AnchorOverview> {
  await assertAnchorAdmin(x, actor);
  const [[waiting], [unsealed], batches] = await Promise.all([
    x.select({ n: sql<number>`count(*)::int` }).from(evidenceSubmission).where(eligible(x)),
    x.select({ n: sql<number>`count(*)::int` }).from(evidenceSubmission).where(and(eq(evidenceSubmission.status, "APPROVED"), sql`${evidenceSubmission.manifestHash} is null`)),
    x
      .select({
        id: anchorBatch.id,
        status: anchorBatch.status,
        leafCount: anchorBatch.leafCount,
        merkleRoot: anchorBatch.merkleRoot,
        txHash: anchorBatch.txHash,
        blockNumber: anchorBatch.blockNumber,
        contractAddress: anchorBatch.contractAddress,
        createdAt: anchorBatch.createdAt,
        confirmedAt: anchorBatch.confirmedAt,
      })
      .from(anchorBatch)
      .orderBy(desc(anchorBatch.id))
      .limit(50),
  ]);
  let configured = true;
  try {
    configuredChain();
  } catch (e) {
    if (!(e instanceof ChainUnavailable)) throw e;
    configured = false;
  }
  return { waiting: waiting!.n, unsealed: unsealed!.n, configured, batches };
}
