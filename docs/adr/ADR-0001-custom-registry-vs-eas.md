# ADR-0001 — Custom anchor registry rather than an attestation standard

**Status:** Accepted
**Date:** 2026-11-01
**Deciders:** Shoumik Orgho

## Context

Approved evidence manifests need a public, tamper-evident reference. The
options were a general attestation service (EAS or similar) or a purpose-built
registry contract.

## Decision

Write `ImpactAnchorRegistry.sol`: a minimal contract that stores one Merkle
root per batch id and exposes a pure proof-verification helper.

## Reasoning

- Delta anchors one root per day, not one attestation per record. A batching
  contract is a few dozen lines; bending a per-attestation schema into batch
  semantics is more code, not less.
- The verification surface is a single `eth_call` with no SDK, no indexer and
  no schema registry lookup. A visitor can reproduce it with `cast`.
- Owning the contract means owning its test matrix. Access control, duplicate
  prevention and proof verification are all directly fuzzed.
- No dependency on a third party's deployment, schema registry or uptime.

## Consequences

- We carry the audit burden for our own Solidity. Mitigated by keeping the
  contract tiny, inheriting OpenZeppelin `Ownable2Step` and `MerkleProof`, and
  testing exhaustively with Foundry.
- Delta's attestations are not discoverable by generic attestation explorers.
  Acceptable: discovery happens through Delta's own public API and proof pages.

## Alternatives rejected

**EAS** — richer ecosystem, but per-attestation semantics and a heavier
verification path for a page that must work with no SDK.
**A merkle root in a transaction's calldata with no contract** — cheapest, but
no on-chain verification helper and no access control.
