# ADR-0005 — Merkle leaf and canonical manifest layout

**Status:** Accepted
**Date:** 2026-11-01
**Deciders:** Shoumik Orgho

## Context

Three runtimes must compute identical bytes forever: the Node backend when
anchoring, the browser when a visitor verifies, and Solidity when checking a
proof. Any drift breaks every historical anchor.

## Decision

**Manifest.** Schema `"delta.manifest.v2"`, serialised with `canonicalize`
(RFC 8785). `manifestHash = SHA256(utf8Bytes(canonicalize(manifest)))`.

Fields: `schema`, `submissionId`, `projectId`, `ownerOrgId`, `verifierOrgId`,
`files`, `locationCommitment`, `fuzzedLocation`, `approvedAtIso`,
`quorumReviewIds`, `orgAuditChainHead`.

`files` is an array of `{role, round, sha256, dhash}`, one entry per
`evidence_file` row, replacing the flat before/after fields of `v1` so that a
supplement file can be committed to. Its order is part of the frozen contract:
`role` in the fixed order `BEFORE`, `AFTER`, `SUPPLEMENT`, then `round`
ascending, then `sha256` ascending. Every sort key is a field of the entry, so
the order is reproducible from the manifest alone. `v1` was never anchored.

**Leaf.**
`StandardMerkleTree.of(leaves, ["bytes32","bytes32","uint256"])` where
`leaf = [submissionIdBytes32, manifestHashBytes32, approvedTimestamp]`, sorted
ascending by `submissionId`.

## Reasoning

- RFC 8785 fixes key ordering, number formatting and string escaping. Plain
  `JSON.stringify` does not, and differs across engines.
- `StandardMerkleTree` double-hashes leaves, which prevents second-preimage
  attacks against internal nodes, and ships a matching Solidity verifier.
- Including `orgAuditChainHead` binds each manifest to the organisation's
  audit chain at approval time, so the decision history cannot be rewritten
  without the anchored manifest diverging.
- Including `locationCommitment` rather than coordinates means the public
  manifest proves a location claim without publishing the location.
- Deterministic leaf ordering makes the whole tree reproducible from the
  database by anyone with the public API.

## Consequences

- `src/lib/crypto/` is frozen. Changing any field, its order, or the timestamp
  format requires a new schema version and a maintainer decision — never an
  in-place edit.
- Timestamps are ISO 8601 UTC with `Z`, millisecond precision, no offset
  notation.
- A test asserts the manifest hash is byte-identical in Node and in a real
  browser (Playwright), not merely in two Node code paths.

## Alternatives rejected

**Hashing `JSON.stringify` output** — not deterministic across runtimes.
**Including exact geometry in the manifest** — would publish sensitive site
coordinates permanently and irrevocably.
**One leaf per evidence file** — doubles tree size with no verification gain;
the manifest already commits to every file hash.
