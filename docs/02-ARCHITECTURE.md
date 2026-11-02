# 02 — Architecture

Authority over: layering, folder structure, cross-runtime cryptographic contracts.

---

## 1. Shape

A **modular monolith**. One Next.js application, one Postgres database, strict
internal layer boundaries.

```
Browser ──► Server Actions  ─┐
                             ├──► src/server/services/* ──► Postgres / Blob / Gemini / Base Sepolia
Clients ──► /api/v1 routes  ─┘        (all domain logic + every tenancy check)
```

Server Actions and route handlers are **thin adapters**. They parse input with
Zod, call exactly one service function, and shape the response. They contain
no business rules, no tenancy checks of their own, and no database access.

**Why a monolith:** the integrity guarantees depend on transactions that span
several tables — advisory lock, audit append, state transition, finding writes.
Splitting services across processes would require distributed transactions to
preserve the hash chain. Record this in `ADR-0003`.

## 2. Folder structure

```text
delta-mrv/
├── contracts/                      Foundry project
│   ├── src/ImpactAnchorRegistry.sol
│   ├── test/ImpactAnchorRegistry.t.sol
│   ├── script/Deploy.s.sol
│   └── foundry.toml
├── docker/
│   └── db.Dockerfile               PostGIS + pgvector in one image
├── docs/                           This document set
│   └── adr/
├── drizzle/                        Generated SQL migrations
├── scripts/
│   ├── check-forbidden-deps.mjs    CI guard
│   ├── lib/db.ts                   Standalone client for scripts (no server-only)
│   ├── seed.ts
│   ├── eval-forensics.ts
│   └── verify-audit-chain.ts
├── src/
│   ├── env.ts                      Zod-validated environment
│   ├── proxy.ts                    Next 16 route proxy (NOT middleware.ts)
│   ├── app/                        ROUTING AND THIN ADAPTERS ONLY
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (workspace)/
│   │   └── api/
│   ├── components/                 PRESENTATION ONLY
│   │   ├── ui/                     shadcn primitives, CLI-generated
│   │   ├── atlas/
│   │   ├── lab/
│   │   ├── proof/
│   │   └── capture/                PWA offline capture
│   ├── lib/                        ISOMORPHIC — must run in browser AND Node
│   │   ├── crypto/                 FROZEN. Manifest, RFC 8785, Merkle verify
│   │   ├── state-machine/
│   │   └── format/                 Hash/coordinate/distance display helpers
│   └── server/                     SERVER ONLY — every file starts: import "server-only"
│       ├── auth/
│       ├── db/
│       │   ├── client.ts
│       │   └── schema/
│       ├── storage/                StoragePort + blob adapter
│       └── services/
│           ├── projects.service.ts
│           ├── submissions.service.ts
│           ├── reviews.service.ts
│           ├── jobs.service.ts
│           ├── forensics.service.ts
│           ├── ai-audit.service.ts
│           ├── audit-chain.service.ts
│           └── anchor.service.ts
├── test/
│   ├── stubs/empty.ts              Stubs server-only for Vitest
│   └── integration/
├── CLAUDE.md
├── AGENTS.md                       → points at CLAUDE.md
├── docker-compose.yml
├── drizzle.config.ts
├── eslint.config.mjs
├── pnpm-workspace.yaml
├── playwright.config.ts
└── vitest.config.ts
```

## 3. Layer boundaries — enforced, not advisory

`eslint.config.mjs` applies `no-restricted-imports`:

| Layer | May import from |
|---|---|
| `src/app/**` | `src/components`, `src/lib`, `src/server/services`, `src/server/auth` |
| `src/components/**` | `src/components`, `src/lib`. **Never `src/server/**`** |
| `src/lib/**` | `src/lib` only. No Node built-ins beyond Web Crypto. Must bundle for the browser |
| `src/server/**` | Anything |
| `scripts/**` | `src/lib`, `scripts/lib`. **Never `src/server/**`** (it imports `server-only`) |

A direct `src/server/db` import inside `src/app` or `src/components` is a
build failure, not a code review note.

## 4. Cross-runtime cryptographic contracts

Three runtimes must agree forever: the Node backend, the browser proof
verifier, and the Solidity contract. These definitions live in
`src/lib/crypto/` and are **frozen**.

### 4.1 Authoritative file hash

- Computed **server-side** from the immutable bytes stored in blob storage —
  never from what the client claims.
- `SHA-256`, 64-character lowercase hex.
- Node: `node:crypto`. Browser: `crypto.subtle.digest("SHA-256", buffer)`.

### 4.2 Deterministic 64-bit dHash

Pipeline, via `sharp`, identical in intake, seed script and eval harness:

1. Convert to grayscale
2. Resize to exactly **9 columns × 8 rows**
3. For each row, compare adjacent horizontal pixels: `bit = left > right ? 1 : 0`
4. Pack row-major, MSB first, into a 64-character `'0'|'1'` string
5. Store in a Postgres `bit(64)` column, HNSW-indexed with `bit_hamming_ops`

### 4.3 Location commitment and fuzzing

```
locationCommitment = SHA256("DELTA_LOC_V1:" + salt_hex + ":" + canonicalize(exactGeoJson))
```

- `fuzzedLocation` — area-level centroid, safe for public display
- Unauthenticated API, map tiles and proof pages **never** return
  `exactGeoJson` or `salt_hex`
- Authorised sessions (owner org, assigned verifier) receive both so they can
  verify the commitment themselves

### 4.4 Canonical evidence manifest

- Schema version string: `"delta.manifest.v2"`
- Serialised with `canonicalize` (RFC 8785). Never `JSON.stringify`.
- Fields: `schema`, `submissionId`, `projectId`, `ownerOrgId`, `verifierOrgId`,
  `files`, `locationCommitment`, `fuzzedLocation`, `approvedAtIso`,
  `quorumReviewIds`, `orgAuditChainHead`
- `files` is an ordered array with one entry per row of `evidence_file`
  (`docs/03-DATABASE.md`). Each entry is exactly `{role, round, sha256, dhash}`.
  It replaces the four flat `before*`/`after*` fields of `v1`, so a supplement
  file can be committed to. The bump to `v2` lands before any anchoring
  exists.
- **Ordering of `files`** — part of the frozen contract. Sort by:
  1. `role` in the fixed order `BEFORE`, `AFTER`, `SUPPLEMENT` (this order,
     not alphabetical)
  2. then `round`, ascending numerically
  3. then `sha256`, ascending, as the final tiebreak
  Every sort key is a field of the entry itself, so a browser verifier can
  reproduce the order from the manifest alone, with no database access. A
  manifest whose `files` are not in this order is invalid.
- `manifestHash = SHA256(utf8Bytes(canonicalize(manifest)))`

Timestamps are ISO 8601 UTC with `Z`, millisecond precision, no offset
notation. Numbers are serialised per RFC 8785 rules. A manifest that
round-trips to a different hash in the browser than on the server is a
critical defect.

### 4.5 Hash-chained audit log

Inside a transaction:

```sql
SELECT pg_advisory_xact_lock(hashtext(org_id));
```

```
eventHash = SHA256("DELTA_AUDIT_V1:" + prevEventHash + ":" + canonicalize(eventPayload))
```

Genesis `prevEventHash` is 64 zeros. Unique constraint on `(org_id, seq)`.
Chain verification is a script (`scripts/verify-audit-chain.ts`) and a test
that proves a tampered row breaks verification at that exact sequence number.

### 4.6 Merkle leaves

```ts
StandardMerkleTree.of(leaves, ["bytes32", "bytes32", "uint256"])
// leaf = [submissionIdBytes32, manifestHashBytes32, approvedTimestamp]
```

Leaf ordering is deterministic: ascending `submissionId`. Documented in
`ADR-0005`.

## 5. Amendment rule

If an approved record is amended after anchoring, create a **new manifest
version** and anchor it separately. Never replace, never re-anchor the same
version. Both versions remain publicly visible with their own proofs.

## 6. Failure isolation

External service failure must never destroy evidence.

| Failure | Behaviour |
|---|---|
| Gemini down / quota | Finding recorded as `ai_unavailable`. Pipeline continues. |
| Blob upload fails | Submission is not created. Client told to retry. Nothing half-written. |
| RPC unreachable | Proof page shows `UNAVAILABLE`, not `MISMATCH`. Batch stays `PENDING`. |
| Transaction reverts | Batch marked `FAILED` with the revert reason. Submissions return to `APPROVED` and are eligible for the next batch. |
| Job worker crashes | Row stays locked until the transaction aborts, then becomes claimable. Attempts increment; after N it is `STUCK` and surfaced in admin. |

Every processing stage carries an explicit status:
`PENDING | PROCESSING | COMPLETED | FAILED | UNAVAILABLE`.
There is no implicit "probably fine".
