# Delta

Delta is a multi-tenant Measurement, Reporting and Verification (MRV) platform for
environmental restoration: mangrove planting, wetland recovery, river cleanups.

It turns restoration claims from things people say into things anyone can check, by making the
evidence, the reviewer, and the review itself verifiable by a stranger with a browser.

```
PROJECT → SUBMIT EVIDENCE → ANALYSE → INDEPENDENT REVIEW → ANCHOR → PUBLIC VERIFY
```

## The problem

Restoration is funded on the strength of spreadsheets, PDFs and self-reported photographs.
Four frauds are routine and hard to detect:

| Fraud | What it looks like |
|---|---|
| Double claiming | The same photo submitted against two grants or two projects |
| Location spoofing | Photos taken outside the claimed restoration boundary |
| Self-auditing | The organisation that did the work also signs off that it was done |
| Silent tampering | Review logs or evidence metadata edited after approval |

## What it proves, and what it does not

**It proves**

- The evidence file existed at a recorded point in time
- The evidence has not changed since approval (hash comparison against chain)
- It passed stated consistency checks — location, duplicates, timestamps
- It was approved by named humans from an organisation independent of the claimant
- The review history has not been silently rewritten (hash-chained audit log)

**It does not prove**

- That trees were actually planted, or that they survived
- That the photograph was taken where or when the EXIF says
- Anything the AI "observed" — that is an opinion, logged as an opinion

EXIF can be forged, an AI cannot count saplings, and a matching hash only means the record is
unchanged. Inspection on the ground is still needed.

## How it works

1. **An NGO submits a before/after pair** for a project with a drawn boundary. The browser
   uploads straight to private storage. The server reads the stored bytes back and hashes
   those: a hash sent by the client is never trusted. Photos captured with no signal wait in
   an on-device queue.
2. **A forensic pipeline writes findings.** Exact reuse (SHA-256), near-duplicates (64-bit
   dHash, Hamming distance under 8), position against the boundary (PostGIS), capture time, and
   whether before and after differ at all. Each finding has a severity and a reason a person
   can read. A finding is a signal. It approves nothing and blocks nothing.
3. **Verifiers from a different organisation decide.** Two approvals from two distinct people
   are needed. Every decision needs a written reason. A reviewer cannot see a colleague's vote
   until they have cast their own. One approval and one rejection escalate to an admin inside
   the verifier organisation.
4. **Approved records are anchored.** Each approved record is sealed into a canonical manifest
   (RFC 8785). A day's manifests become one Merkle root, written to a registry contract on
   Base Sepolia.
5. **Anyone can check.** The public proof page recomputes the manifest hash in the visitor's
   browser and verifies the Merkle proof against the contract. Drop the original photo on the
   page and it is hashed locally and compared. The file never leaves the browser.

## The rules the code enforces

- **No one reviews their own organisation's work.** Enforced in the service layer, with no
  admin override, no feature flag and no demo bypass. Proven by a dedicated test suite.
- **AI never changes state.** The optional Gemini pass writes one low-severity advisory note.
  It cannot approve, reject, score or change a status.
- **Append-only means append-only.** Review decisions, audit events and anchor leaves cannot
  be updated, deleted or truncated: grants are revoked and a trigger refuses the statement.
- **Signals, not a magic number.** The risk score is a cached sum of the findings, versioned,
  always shown beside the findings that produced it. It never gates a transition.
- **Exact site locations stay private.** Public pages and the public API receive the centre of
  a grid cell about 5.6 km across, plus a salted commitment to the real boundary.

## Threat model, in short

The full version is [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

| Threat | What stops it | What remains |
|---|---|---|
| A photo reused across projects or grants | SHA-256 and dHash search across every tenant | A cropped or rotated copy evades the fingerprint (measured below) |
| A photo taken outside the boundary | EXIF position checked against the PostGIS polygon | EXIF position is easy to forge |
| Self-approval | The conflict-of-interest rule, a two-person quorum, explicit assignment | Two independent organisations can still collude. It is visible and attributable, not prevented |
| History rewritten after approval | Append-only tables, a hash chain per organisation, public anchoring | A database superuser can rewrite rows, but not what is already anchored |
| Site coordinates leaked | Server-side fuzzing, leak tests on every public endpoint | Many fuzzed centres could narrow a location |
| Prompt injection through a photo | The AI output has no field that can change anything | A misleading advisory note a reviewer may ignore |
| One tenant learning about another through a match | A match discloses its distance and an opaque reference, nothing else | That a match exists is itself a small signal |
| A network failure shown as tampering | Four verification states. An unreachable chain is neutral, never a mismatch | |

Out of scope: proving an activity physically happened, verifying an organisation's identity,
availability, and the legal weight of any record.

## Measured, not asserted

**Duplicate detection** ([docs/FORENSIC_EVAL.md](docs/FORENSIC_EVAL.md), regenerated by
`pnpm eval:forensics`). Three real photographs, each edited five ways, through the real
fingerprint at the real threshold:

| | |
|---|---|
| Precision | 100% (5 of 5 matches were real copies) |
| Recall over resize, re-compression and a 10% crop | 56% (5 of 9) |
| Recall over every edited copy, including rotation and a 40% crop | 33% (5 of 15) |
| False matches between different photographs | 0 of 6 |

A re-saved or shrunk copy is usually caught. A cropped or rotated copy is not. Three
photographs is a small sample. The same table is published on the `/trust` page, and the test
suite fails if the pipeline stops producing exactly these counts.

**Query latency** (`pnpm bench:queries`, 2026-11-13). The seeded history of 5,208 submissions
and 10,416 fingerprinted files, PostgreSQL 18 in local Docker on a laptop, 400 runs each,
milliseconds:

| Query | Clients | p50 | p95 |
|---|---|---|---|
| Near-duplicate search (Hamming distance under 8) | 1 | 6.4 | 15.2 |
| Near-duplicate search (Hamming distance under 8) | 8 | 6.7 | 11.4 |
| Geofence check (`ST_Covers`, `ST_DWithin`, `ST_Distance`) | 1 | 1.7 | 2.1 |
| Geofence check (`ST_Covers`, `ST_DWithin`, `ST_Distance`) | 8 | 2.0 | 3.6 |

The duplicate search is an exact scan on purpose. An approximate index would let a replay
disagree with the first run.

**Tests.** 235 unit tests, 150 integration tests against a real PostGIS database, 16 Foundry
tests on the contract, and a Playwright run of the whole path from a field photo to a proof
checked in a browser.

## Status

Built and tested end to end on a local stack: intake, forensics, review, the audit chain,
anchoring, the proof page, the public API and the funder view.

Not done yet:

- The registry contract is **not deployed to Base Sepolia**. Anchoring has only run against a
  local chain, so no proof on a public network exists yet.
- There is no hosted deployment.
- Webhooks are not built.
- No email is sent: no address verification and no password reset.

## Run it locally

Needs Node 22+, pnpm 11, Docker, and [Foundry](https://getfoundry.sh) for the local chain.

```bash
pnpm install
cp .env.example .env.local        # set BETTER_AUTH_SECRET to 32 or more random characters
docker compose up -d              # PostgreSQL 18 with PostGIS and pgvector

export DATABASE_URL_UNPOOLED=postgresql://delta:delta_local@localhost:5432/delta
pnpm db:migrate

pnpm dev:local                    # seeds, starts a local chain, serves http://localhost:3000
```

`pnpm dev:local` uses the Docker database, a local chain with the real contract, and evidence
stored on disk. It reaches no external service. Open `/demo` to sign in as the field officer,
either verifier, the audit admin or the funder.

| Command | What it does |
|---|---|
| `pnpm check` | ESLint, TypeScript, unit tests, the forbidden-dependency guard |
| `pnpm test:integration` | Services against the database: conflict of interest, tenancy, append-only, queue, forensics, anchoring |
| `pnpm contracts:test` | Foundry tests on `ImpactAnchorRegistry.sol` |
| `pnpm test:e2e` | Playwright, the whole demo path on the local stack |
| `pnpm eval:forensics` | Re-measures duplicate detection and rewrites `docs/FORENSIC_EVAL.md` |
| `pnpm forensics:replay <submissionId>` | Re-runs forensics over the stored bytes and fails unless the findings are byte-identical |
| `pnpm bench:queries` | Times the duplicate search and the geofence check on local Docker |

## Routes

```
Public
  /                       Landing page
  /atlas                  Map of projects, area-level positions only
  /p/[id]                 Public project page
  /proof/[id]             Proof dossier, verified in the browser
  /verify                 Look up a proof id, a transaction hash or a dropped photo
  /trust                  What is proved, every check, measured results, limits

Workspace (signed in)
  /dashboard              Home, by role: owner, verifier or funder
  /projects/new           Register a site and draw its boundary
  /projects/[id]          Project workspace with the exact boundary
  /projects/[id]/submit   Evidence intake and the offline queue
  /lab                    Review queue for assigned verifiers
  /admin                  Anchoring, audit chain verification, review assignment

API
  /api/v1/submissions/[id]/proof   Public: canonical manifest and Merkle proof
  /api/v1/proofs/lookup            Public: find a proof by id, transaction or file hash
  /api/v1/projects, /stats         API key
```

## Stack

Next.js 16 and React 19. PostgreSQL with PostGIS and pgvector, through Drizzle on postgres.js.
Better Auth with organisations. `sharp` and `exifr` for forensics. Solidity with Foundry, viem
and OpenZeppelin's Merkle tree. MapLibre GL. Tailwind 4.

Runs on free tiers only: no paid service is required.

## Where to read more

- [docs/00-PRODUCT.md](docs/00-PRODUCT.md): the problem, the users, the product boundary
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md): adversaries and mitigations
- [docs/adr/](docs/adr/): five architecture decisions
- [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md): layering and the cross-runtime cryptographic contract

## Authorship

All code and commits are by Shoumik Orgho. Licensed under Apache-2.0.
