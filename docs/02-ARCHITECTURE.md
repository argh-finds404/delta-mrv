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
├── contracts/                      Foundry project: ImpactAnchorRegistry.sol, its tests, Deploy.s.sol
├── docker/db.Dockerfile            PostGIS + pgvector in one image
├── docs/                           This document set, ADRs, eval results
├── drizzle/                        Reviewed SQL migrations 0000–0007 and their snapshots
├── scripts/                        seed, dev-local, eval-forensics, replay, verify-audit-chain,
│   └── lib/                        bench-queries, render-hero-*; scripts/lib: local chain, seed pools
├── public/                         hero art, life photographs, service worker, offline page
├── src/
│   ├── env.ts                      Zod-validated environment, checked at boot
│   ├── proxy.ts                    Next 16 route proxy (NOT middleware.ts): optimistic redirect only
│   ├── app/                        ROUTING AND THIN ADAPTERS ONLY
│   │   ├── (public)/               /, atlas, p/[id] (+ feed.xml), proof/[id], verify, trust
│   │   ├── (auth)/                 sign-in, sign-up (+ finish), forgot-password, reset-password, demo
│   │   ├── (workspace)/            dashboard, projects (new, [id], submit, manage), submissions, lab, admin
│   │   └── api/                    v1 (public), submissions, lab, evidence, internal (cron), dev, auth
│   ├── components/                 PRESENTATION ONLY: admin, app, atlas, auth, hero, lab, motion,
│   │                               projects, proof, site, submit, verify, and small primitives
│   ├── lib/                        ISOMORPHIC — must run in browser AND Node
│   │   ├── crypto/                 FROZEN. Manifest, RFC 8785, Merkle leaves, location commitment
│   │   ├── forensics/              dHash, claims.v1, c2pa.v1, NDVI arithmetic, ELA, MIME sniffing
│   │   ├── geo/                    Area and perimeter, boundary files, fuzzing, UTM
│   │   ├── scoring/  state-machine/  chain/  format/
│   │   └── capture-statement.ts  proof-bundle.ts  feeds.ts  safe-next.ts …
│   └── server/                     SERVER ONLY — every file starts: import "server-only"
│       ├── auth/                   Better Auth configuration, session helpers
│       ├── db/                     client.ts and schema/ (auth, projects, evidence, governance, operations)
│       ├── storage/                StoragePort: private Vercel Blob, local disk in development
│       ├── chain/  ai/             ChainPort (viem), AIPort (Gemini): every outside service behind a port
│       ├── satellite/              Earth Search catalogue, minimal COG range reader
│       ├── forensics/              C2PA Content Credentials WASM reader (@contentauth/c2pa-wasm)
│       ├── email.ts                Resend over fetch, or a development outbox
│       └── services/               The domain: projects, submissions, reviews, forensics, checkups,
│                                   feeds, anchor, audit-chain, admin, jobs, ndvi, ai-audit, api-key,
│                                   funder, operators, access (tenancy), errors
├── test/                           unit tests; integration/ (real PostGIS); e2e/ (Playwright)
├── CLAUDE.md  AGENTS.md  README.md  LICENSE
├── docker-compose.yml  drizzle.config.ts  eslint.config.mjs  next.config.ts
└── playwright.config.ts  vitest.config.ts  vitest.integration.config.ts  pnpm-workspace.yaml
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
2. Resize to exactly **9 columns × 8 rows** with sharp's **`lanczos3`** kernel and
   `fit: "fill"`. The kernel is part of the frozen contract: a different kernel
   produces different pixels, so a different hash, and duplicate detection between
   rows hashed by different code paths would silently miss. The exact options are
   exported as `DHASH_RESIZE` from `src/lib/forensics/dhash.ts`; every caller passes
   that object and none writes its own.
3. For each row, compare adjacent horizontal pixels: `bit = left > right ? 1 : 0`
4. Pack row-major, MSB first, into a 64-character `'0'|'1'` string
5. Store in a Postgres `bit(64)` column, HNSW-indexed with `bit_hamming_ops`

### 4.3 Location commitment and fuzzing

The commitment is implemented in `src/lib/crypto/location.ts`, approved and frozen
2026-11-03.

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
- **Object shape of a `files` entry is fixed.** Every entry always carries all
  four keys — `role`, `round`, `sha256`, `dhash`. Keys are never omitted. When
  a file has no perceptual hash, `dhash` is JSON `null`, not absent and not an
  empty string. The shape and the `null` rule are part of the frozen contract.
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
