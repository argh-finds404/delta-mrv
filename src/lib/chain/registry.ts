// ImpactAnchorRegistry as the server and a visitor's browser both see it (docs/09-WEB3.md §3).
// Not part of the frozen src/lib/crypto contract: it names the contract's interface and repeats,
// with viem, the leaf hash that OpenZeppelin's StandardMerkleTree and the Solidity verifier
// already agree on (contracts/test reads the same vectors as test/crypto-contract.test.ts).
import { encodeAbiParameters, keccak256, parseAbi } from "viem";
import { LEAF_ENCODING, type Leaf } from "../crypto/merkle";

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const REGISTRY_ABI = parseAbi([
  "function anchorBatch(uint256 batchId, bytes32 merkleRoot, uint32 leafCount)",
  "function getAnchor(uint256 batchId) view returns ((bytes32 merkleRoot, uint64 anchoredAt, uint32 leafCount))",
  "function verify(uint256 batchId, bytes32[] proof, bytes32 leaf) view returns (bool)",
  "function isAnchorer(address anchorer) view returns (bool)",
  "error NotAnchorer(address caller)",
  "error AlreadyAnchored(uint256 batchId)",
  "error ZeroRoot()",
  "error ZeroLeafCount()",
]);

/** What the contract's verify() takes: keccak256(bytes.concat(keccak256(abi.encode(leaf)))). */
export const leafHash = (leaf: Leaf): `0x${string}` => keccak256(keccak256(encodeAbiParameters(LEAF_ENCODING.map((type) => ({ type })), leaf)));

const EXPLORER = "https://sepolia.basescan.org";
export const explorerTx = (txHash: string) => `${EXPLORER}/tx/${txHash}`;
export const explorerAddress = (address: string) => `${EXPLORER}/address/${address}`;
