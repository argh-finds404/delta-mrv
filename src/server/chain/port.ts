import "server-only";

type Hex = `0x${string}`;

/**
 * The chain as the anchor service needs it (docs/09-WEB3.md §5): three questions and one
 * transaction. The viem adapter and its signer live in anchor.service.ts, the only file that
 * reads the anchor key; tests pass an adapter pointed at a local anvil chain.
 */
export interface ChainPort {
  readonly chainId: number;
  readonly contractAddress: Hex;
  /** The root the contract holds under a batch id, or null when nothing is anchored there. */
  anchoredRoot(batchId: bigint): Promise<Hex | null>;
  /** Simulates, then sends anchorBatch. Throws with the reason instead of sending a transaction that would revert. */
  sendAnchor(batchId: bigint, merkleRoot: Hex, leafCount: number): Promise<Hex>;
  /** The mined receipt, or null when the transaction is not mined within the adapter's wait. */
  receipt(txHash: Hex): Promise<{ ok: boolean; blockNumber: bigint } | null>;
}

/** The chain is not configured on this server: callers answer 503, never an internal error. */
export class ChainUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainUnavailable";
  }
}
