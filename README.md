# Delta

Delta is a multi-tenant Measurement, Reporting and Verification (MRV) platform for environmental
restoration: mangrove planting, wetland recovery, river cleanups, tree planting, coastal belts.

It turns restoration claims from things people say into things anyone can check, by making the
evidence, the reviewer, and the review itself verifiable by a stranger with a browser.

```
REGISTER A SITE → SUBMIT EVIDENCE → AUTOMATIC CHECKS → INDEPENDENT REVIEW → ANCHOR → ANYONE VERIFIES
                                                                              ↓
                                                         SURVIVAL CHECK-UPS, MONTHS LATER
```

## Contents

[The problem](#the-problem) · [What it proves](#what-it-proves-and-what-it-does-not) ·
[How it works](#how-it-works) · [Features](#features) · [Architecture](#architecture) ·
[Data model](#data-model) · [Authentication and tenancy](#authentication-and-tenancy) ·
[API](#api) · [User interface](#user-interface) · [Threat model](#threat-model-in-short) ·
[Measured, not asserted](#measured-not-asserted) · [Run it locally](#run-it-locally) ·
[Configuration](#configuration) · [Status and deployment](#status-and-deployment) ·
[Credits](#credits-and-design-sources)

## The problem

Restoration is funded on the strength of spreadsheets, PDFs and self-reported photographs.
Five failures are routine and hard to detect:

| Failure | What it looks like |
|---|---|
| Double claiming | The same photo submitted against two grants or two projects |
| Location spoofing | Photos taken outside the claimed restoration boundary |
| Inflated claims | 12,000 saplings claimed on a site that could hold a tenth of them |
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
unchanged. Survival check-ups narrow the second gap over time; they do not close it. Inspection
on the ground is still needed.

## How it works

1. **An owner registers a site.** The boundary is drawn on a map or imported from a GeoJSON or
   KML file (QGIS, a GPS unit, Google Earth). It is stored privately; the public sees only a grid
   cell about 5.6 km across and a salted commitment that fixes the boundary without revealing it.
2. **The field team submits a before/after pair.** Photos are fingerprinted on the device and
   uploaded straight to private storage; the server reads the stored bytes back and hashes those.
   With no signal, the pair waits in an on-device vault. Today's photo is laid over the earlier
   one to check the framing before it is sent.
3. **Automatic checks write findings.** Exact reuse (SHA-256) and near-duplicates (64-bit dHash)
   across every tenant, position against the boundary (PostGIS), capture time, whether before and
   after differ at all, and whether the claim fits the boundary. Each finding has a severity and
   a reason a person can read. A finding approves nothing and blocks nothing.
4. **Reviewers from an independent organisation decide.** A Delta operator assigns an
   independent verifier organisation; nobody reviews their own organisation's work. Two approvals
   from two people are needed, each with a written reason, and a vote is hidden from colleagues
   until they have cast their own. A split escalates to an admin inside the verifier
   organisation; asking for more proof opens a new round.
5. **Approved records are anchored.** Each is sealed into a canonical manifest (RFC 8785); a
   day's manifests become one Merkle root, written to a registry contract on Base Sepolia.
6. **Anyone checks.** The proof page recomputes the manifest hash in the visitor's browser and
   asks the contract. A dropped original photo is hashed locally and compared. A downloaded proof
   file can be rechecked years later on `/verify`, with no Delta server at all.
7. **The site is revisited.** Owners promise check-ups every few months; each is one new photo of
   the same spot, reviewed like any submission. A missed visit is shown as missed.

## Features

| Area | What exists | Where |
|---|---|---|
| Sites | Boundary drawn on a map or imported from GeoJSON/KML; area, perimeter and claim density shown live; exact geometry private | `/projects/new`, `src/lib/geo/` |
| Intake | Before/after pair, device fingerprint, direct upload with progress, offline vault (IndexedDB), framing check, optional device signature (WebCrypto P-256) | `/projects/[id]/submit`, `src/components/submit/` |
| Checks | SHA-256 and dHash reuse across tenants, EXIF time and position against PostGIS, no-change, claim against boundary (`claims.v1`), C2PA Content Credentials (`c2pa.v1`), advisory AI note, advisory Sentinel-2 NDVI with a same-season baseline | `src/server/services/forensics.service.ts`, `docs/10-FORENSICS.md` |
| Review | Keyboard-first queue (windowed, filter pills), slider and side-by-side comparison, rounds, error-level lens, written reasons, blind votes, 2-of-N quorum, escalation | `/lab` |
| Survival | Check-up schedule per project (only shortened once approved), one-photo check-ups compared with the approved photo, due/overdue tracking | `/projects/[id]/manage`, `/p/[id]`, `checkups.service.ts` |
| Integrity | Per-organisation hash-chained audit log, append-only tables, Merkle anchoring, deterministic replay | `audit-chain.service.ts`, `anchor.service.ts`, `contracts/` |
| Public proof | Proof dossier verified in the browser, drop-a-photo check, offline proof file (`.delta-proof.json`), print stylesheet | `/proof/[id]`, `/verify` |
| Partners | Public API v1, API keys for funders, pull-only JSON Feed and Atom per project, full contents of every confirmed batch | `/api/v1/*`, `/p/[id]/feed.xml` |
| Accounts | Email and password, organisations with a fixed type, invitations, optional email confirmation and password reset | `src/server/auth/`, `src/server/email.ts` |
| Operations | Operators (`OPERATOR_EMAILS`): reviewer assignment, anchoring, job queue, `matchRef` resolution, audit-chain checks, tamper demo | `/admin` |

The scope is fixed by [docs/01-FEATURE-LOCK.md](docs/01-FEATURE-LOCK.md): anything not listed
there is out of scope, and a CUT list (tokens, payments, automated approval, AI counting
presented as fact) is never built.

## Architecture

A modular monolith: one Next.js application, one Postgres database, strict internal layers.
The integrity guarantees depend on transactions that span several tables (advisory lock, audit
append, state transition, finding writes), which is why it is one process
([ADR-0003](docs/adr/)).

```
 Browser ─┬─► Server Components / Server Actions ─┐
          └─► Route handlers (src/app/api/*) ──────┼─► src/server/services/*  ─┬─► Postgres (Drizzle, postgres.js)
 Clients ───► /api/v1 (public, API key) ───────────┘   every rule, every         ├─► Evidence storage (StoragePort: Blob | disk)
 Cron ──────► /api/internal/* (CRON_SECRET) ─────────►  tenancy check            ├─► Base Sepolia (ChainPort, viem)
                                                                                  ├─► Gemini (AIPort, advisory)
                                                                                  ├─► Earth Search (satellite, advisory)
                                                                                  └─► Resend (email, optional)
 src/lib/* ── isomorphic: crypto, geo, forensics maths, proof file, feeds ── used by browser and server alike
```

**Layers, enforced by ESLint** (`no-restricted-imports` in `eslint.config.mjs`; a breach fails
`pnpm check`):

| Layer | Holds | May import |
|---|---|---|
| `src/app/**` | Routes, pages, Server Actions, route handlers: parse, call one service, shape the answer | `components`, `lib`, `server/services`, `server/auth` |
| `src/components/**` | Presentation only | `components`, `lib`. Never `server` |
| `src/lib/**` | Isomorphic logic: runs in the browser and in Node | `lib` only, no Node built-ins |
| `src/server/**` | Services, database, storage, chain, AI, satellite, email, auth (`import "server-only"`) | anything |
| `scripts/**` | Seed, evals, replay, benchmarks | `lib`, `scripts/lib`. Never `server` |

**Frozen cross-runtime contracts.** `src/lib/crypto/` (the canonical manifest, RFC 8785
serialisation, the Merkle leaf layout and the location commitment) must give identical bytes in
Node, the browser and Solidity, forever. Changing them silently invalidates every anchor already
on chain, so they are frozen and only ever versioned ([docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) §4).

```text
src/
├── env.ts                 Zod-validated environment, checked at boot
├── proxy.ts               Next 16 proxy: optimistic sign-in redirect (never security)
├── app/
│   ├── (public)/          /, /atlas, /p/[id] (+ feed.xml), /proof/[id], /verify, /trust      theme Paper
│   ├── (auth)/            sign-in, sign-up (+ finish), forgot/reset password, demo              theme Field
│   ├── (workspace)/       dashboard, projects, submit, manage, submissions, lab, admin         theme Field
│   └── api/               v1 (public), submissions, lab, evidence, internal (cron), dev
├── components/            admin, app, atlas, auth, hero, lab, motion, projects, proof, site,
│                          submit, verify, and small primitives (badges, chips, hash display…)
├── lib/                   crypto (frozen), forensics (dhash, claims, c2pa, ndvi, ela), geo (area,
│                          boundary files, fuzz, utm), scoring, state-machine, chain,
│                          capture-statement, proof-bundle, feeds, format
└── server/
    ├── auth/              Better Auth config and session helpers
    ├── db/                client and schema (auth, projects, evidence, governance, operations)
    ├── forensics/         C2PA Content Credentials WASM reader (@contentauth/c2pa-wasm)
    ├── services/          the domain: projects, submissions, reviews, forensics, checkups,
    │                      feeds, anchor, audit-chain, admin, jobs, ndvi, ai-audit, api-key…
    ├── storage/           StoragePort: Vercel Blob (private) or local disk in development
    ├── chain/  ai/        ports for Base Sepolia and Gemini
    ├── satellite/         Earth Search catalogue and a minimal COG range reader
    └── email.ts           Resend over fetch, or a development outbox
```

**Background work** runs on a Postgres job queue (`FOR UPDATE SKIP LOCKED`, attempts, backoff,
idempotency keys), drained after each request with `after()`, hourly by GitHub Actions, and on
demand from `/admin`. Every external call (AI, satellite, chain, email) fails soft: an
unreachable service is recorded as such and never blocks a submission or reads as tampering.

## Data model

PostgreSQL 18 with PostGIS (geography, not geometry) and pgvector (`bit(64)` Hamming search).
Schema in `src/server/db/schema/`, migrations in `drizzle/` (generated, reviewed, applied with
`pnpm db:migrate`; never `drizzle-kit push`). Full reference: [docs/03-DATABASE.md](docs/03-DATABASE.md).

| Table | What it holds |
|---|---|
| `user`, `session`, `account`, `verification` | Better Auth accounts and sessions |
| `organization`, `member`, `invitation` | Tenants with a fixed `org_type` (OWNER, VERIFIER, FUNDER) and their people |
| `impact_project` | The public face of a site: claim, fuzzed centre, commitment, status, check-up interval |
| `project_private_location` | The exact boundary and its salt; joined only by spatial checks |
| `project_assignment`, `project_funder` | Which verifier organisation reviews a project; which funder follows it |
| `evidence_submission` | One record: status, round, cached score, sealed manifest, device signature, the record a check-up revisits |
| `evidence_file` | Each stored photo: SHA-256, dHash, EXIF facts, GPS, capture time, round |
| `forensic_finding` | One row per automated signal: kind, severity, reason, evidence, rule version |
| `review_decision` | **Append-only.** One vote per reviewer per round, with its reason (`CHECK` ≥ 20 characters) |
| `audit_event` | **Append-only.** Per-organisation hash chain, serialised by an advisory lock |
| `anchor_batch`, `anchor_leaf` | Daily Merkle batches and each record's leaf and proof path (leaves append-only) |
| `job`, `api_key` | The work queue; funders' hashed API keys |

Append-only is enforced by revoked grants **and** a trigger, not by convention. Migrations:
`0000` extensions · `0001` schema · `0002` geography typmods · `0003` append-only · `0004`
indexes · `0005` satellite and device signature · `0006` survival check-ups and claim findings ·
`0007` Content Credentials (C2PA).

## Authentication and tenancy

- **Better Auth** with the organisation plugin, email and password. `activeOrganizationId` is UI
  context only; every service call re-verifies membership on the server
  ([docs/04-AUTH.md](docs/04-AUTH.md)).
- **Organisation types are fixed at sign-up.** Owners submit, verifiers review what they are
  assigned, funders read verified outcomes. Roles inside an organisation: owner, admin, member.
- **The conflict-of-interest rule is the product.** A reviewer's organisation must differ from
  the project's owner; enforced in `src/server/services/`, with no admin override, no flag and no
  demo bypass, and proven by `test/integration/coi.test.ts`.
- **Operators** (`OPERATOR_EMAILS`) run `/admin`. They hold no vote and cannot break a tie.
- **Email (optional).** With `RESEND_API_KEY` and `EMAIL_FROM`, sign-up requires a confirmed
  address (the organisation is created once the link is opened), passwords are reset by email
  (every other session signed out), and an operator's address counts only once confirmed.
  Without them, verification is off.
- **Invitations** are links shown once to an organisation's admin, valid for one address for 48
  hours.
- **API keys** (`dmrv_…`) are hashed at rest and scoped to the funder organisation.

## API

Public routes are session-blind: every caller gets the same bytes, cacheable, with area-level
geometry and never a site's exact boundary or salt (leak-tested in
`test/integration/fuzzing-leak.test.ts`). Full catalogue: [docs/05-ROUTES.md](docs/05-ROUTES.md).

| Route | Access | Returns |
|---|---|---|
| `GET /api/v1/projects` · `/[id]` | public | Projects, fuzzed geometry, paginated |
| `GET /api/v1/projects/[id]/feed` | public | Anchored records as JSON Feed 1.1 (Atom at `/p/[id]/feed.xml`) |
| `GET /api/v1/submissions/[id]/proof` | public | Canonical manifest and Merkle proof of an approved record |
| `GET /api/v1/batches` · `/[id]` | public | Confirmed batches and every leaf, enough to rebuild a root and keep a mirror |
| `GET /api/v1/proofs/lookup` | public | Find a proof by id, file SHA-256 or transaction hash |
| `GET /api/v1/stats` | API key | The key's organisation's funded projects and their records |
| `POST /api/submissions` | session, owner | Start a draft: `{ projectId }` or a check-up `{ checkupOf }` |
| `POST /api/submissions/[id]/upload-token` · `/finalize` · `/supplement` | session, owner | Direct upload, then one transaction that hashes the stored bytes and queues the checks |
| `GET /api/submissions/[id]/findings` · `/decisions` | session | Findings and votes, visible exactly when the record is |
| `GET /api/lab/queue` · `POST /api/lab/decision` | session, verifier | The review queue; one decision with its reason |
| `GET /api/internal/jobs/drain` · `/anchor/daily` | `CRON_SECRET` | The queue drain and the daily anchor |

Pushed webhooks were cut (S10): partners poll the feeds.

## User interface

- **Two themes.** Paper (warm archival, public pages and the proof certificate) and Field (light
  workspace). Tokens in `src/app/globals.css`, rules in
  [docs/06-DESIGN-SYSTEM.md](docs/06-DESIGN-SYSTEM.md): five semantic hues, badges as 14% tints
  with a dot, one call to action per screen, three density tiers (verdict, numbers, artefacts).
- **Colour is tested.** `test/contrast.test.ts` holds every text pairing to WCAG AA; no state is
  told by colour alone, every state has an icon and words.
- **The landing hero** is the maintainer's watercolour illustrations, drawn in by a WebGL shader
  and fading into the page along an ellipse; a still image without WebGL or with reduced motion.
- **Motion** is small and meaningful: pages rise in once, results arrive step by step, icons draw
  their mark once, and the only loop is a curve loader while work is under way. All of it stops
  with `prefers-reduced-motion`.
- **Accessibility.** Keyboard operation throughout (the review queue is keyboard-first), visible
  focus, labelled controls, pages checked at 320 px and 200 % zoom; the newer controls keep
  44 px touch targets on mobile.
- **Performance.** Maps load MapLibre only when they come near the screen; the hero fetches one
  scene ahead; the review queue draws 40 rows at a time.

## Threat model, in short

The full version is [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

| Threat | What stops it | What remains |
|---|---|---|
| A photo reused across projects or grants | SHA-256 and dHash search across every tenant | A cropped or rotated copy evades the fingerprint (measured below) |
| A photo taken outside the boundary | EXIF position checked against the PostGIS polygon | EXIF position is easy to forge |
| An inflated claim | `claims.v1` sets the claim against the drawn boundary | A small, honest-looking exaggeration passes |
| Self-approval | The conflict-of-interest rule, a two-person quorum, explicit assignment by an operator | Two independent organisations can still collude. It is visible and attributable, not prevented |
| History rewritten after approval | Append-only tables, a hash chain per organisation, public anchoring, public batch contents | A database superuser can rewrite rows, but not what is already anchored or mirrored |
| A forged proof file | The file is rehashed, its Merkle path climbed, and only Delta's own registry is asked | |
| Site coordinates leaked | Server-side fuzzing, leak tests on every public endpoint | Many fuzzed centres could narrow a location |
| Prompt injection through a photo | The AI output has no field that can change anything | A misleading advisory note a reviewer may ignore |
| A server tricked into fetching internal addresses | Satellite band files are read only from the Sentinel-2 archive's host, by range | |
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

A re-saved or shrunk copy is usually caught. A cropped or rotated copy is not. Three photographs
is a small sample; the same table is on `/trust`, and the suite fails if the counts change.

**Query latency** (`pnpm bench:queries`, 2026-11-13). 5,208 seeded submissions and 10,416
fingerprinted files, PostgreSQL 18 in local Docker on a laptop, 400 runs each, milliseconds:

| Query | Clients | p50 | p95 |
|---|---|---|---|
| Near-duplicate search (Hamming distance under 8) | 1 | 6.4 | 15.2 |
| Near-duplicate search (Hamming distance under 8) | 8 | 6.7 | 11.4 |
| Geofence check (`ST_Covers`, `ST_DWithin`, `ST_Distance`) | 1 | 1.7 | 2.1 |
| Geofence check (`ST_Covers`, `ST_DWithin`, `ST_Distance`) | 8 | 2.0 | 3.6 |

The duplicate search is an exact scan on purpose: an approximate index would let a replay
disagree with the first run.

**Tests.** 299 unit tests in 23 files; 172 integration tests in 23 files against a real PostGIS
and pgvector database; 16 Foundry tests on the contract; 5 Playwright browser specs over the
full local stack: field photo to public proof, a new site and its reviewer, invitations, email
confirmation and password reset, and a survival check-up.

## Run it locally

Needs Node 22+, pnpm 11, Docker, and [Foundry](https://getfoundry.sh) (`anvil` / `forge` on `PATH`).

```bash
pnpm install
cp .env.example .env.local        # fill the boot variables (DATABASE_URL*, BETTER_AUTH_*, NEXT_PUBLIC_CHAIN_ID=84532)
docker compose up -d              # PostgreSQL 18 with PostGIS and pgvector

export DATABASE_URL_UNPOOLED=postgresql://delta:delta_local@localhost:5432/delta
pnpm db:migrate

pnpm dev:local                    # seeds, starts Anvil and deploys the contract, serves http://localhost:3000
```

`pnpm dev:local` uses the Docker database, a local Anvil chain with the real contract, evidence
on disk (`.local/storage`) and email written to `.local/outbox` instead of sent. It reaches no
external service. Open `/demo` to sign in as the field officer, either verifier, the audit admin
(the demo operator) or the funder; demo accounts are already confirmed.

| Command | What it does |
|---|---|
| `pnpm check` | ESLint (layer rules included), TypeScript, unit tests, the forbidden-dependency guard |
| `pnpm test:integration` | Services against PostGIS: conflict of interest, tenancy, append-only, queue, forensics, anchoring, check-ups, feeds |
| `pnpm contracts:test` | Foundry tests on `ImpactAnchorRegistry.sol` |
| `pnpm test:e2e` | Playwright over the full local stack: the demo path, a new site, invitations, email confirmation and reset, check-ups |
| `pnpm build` | Production Next.js build |
| `pnpm db:migrate` | Applies the Drizzle migrations |
| `pnpm eval:forensics` | Re-measures duplicate detection and rewrites `docs/FORENSIC_EVAL.md` |
| `pnpm forensics:replay <id>` | Re-runs the checks over the stored bytes; fails unless byte-identical |
| `pnpm audit:verify` | Walks every organisation's audit chain from genesis |
| `pnpm bench:queries` | Times the duplicate search and the geofence check on local Docker |

## Configuration

Every variable is in [.env.example](.env.example), validated at boot by `src/env.ts` (a malformed
value stops the server and names the variable, never its value).

| Variable | Needed for |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_CHAIN_ID` | Booting at all |
| `BLOB_READ_WRITE_TOKEN` | Private evidence storage (Vercel Blob) |
| `FORENSICS_MATCH_KEY`, `CRON_SECRET` | Opaque cross-tenant match references; the scheduled routes |
| `BASE_SEPOLIA_RPC_URL`, `ANCHOR_PRIVATE_KEY`, `ANCHOR_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CONTRACT_ADDRESS` | Anchoring and in-browser verification |
| `OPERATOR_EMAILS` | Who runs `/admin` |
| `RESEND_API_KEY`, `EMAIL_FROM` (`EMAIL_OUTBOX_DIR` in development) | Email confirmation and password reset (optional) |
| `NDVI_ENABLED`, `GEMINI_API_KEY` | The advisory satellite and AI checks (optional) |
| `DEMO_MODE` | The demo role switcher and tamper demo |

Everything runs on free tiers; no paid service is required.

## Status and deployment

Every MUST, SHOULD and STRETCH item in the feature lock (including C2PA Content Credentials, X9)
is built and tested on the local stack (`pnpm bench:queries` stands in for k6, which has no HTTP
endpoint to aim at for these queries). Before public use:

- **Deploy the contract** ([contracts/src/ImpactAnchorRegistry.sol](contracts/src/ImpactAnchorRegistry.sol))
  to Base Sepolia by hand and verify it on BaseScan; anchoring has run only on a local Anvil chain.
- **Provision hosting:** the Next.js app with a private Vercel Blob store and the variables
  above; `pnpm db:migrate` (through `0007`); `RESEND_API_KEY` and `EMAIL_FROM` for email (or
  register each operator account before listing it in `OPERATOR_EMAILS` if email stays off);
  repository secrets `APP_URL` and `CRON_SECRET` for
  [.github/workflows/scheduled.yml](.github/workflows/scheduled.yml).

## Where to read more

- [docs/00-PRODUCT.md](docs/00-PRODUCT.md): the problem, the users, the product boundary
- [docs/01-FEATURE-LOCK.md](docs/01-FEATURE-LOCK.md): scope, state machine, cut list
- [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md): layering and the cross-runtime contracts
- [docs/03-DATABASE.md](docs/03-DATABASE.md) · [docs/04-AUTH.md](docs/04-AUTH.md) · [docs/05-ROUTES.md](docs/05-ROUTES.md)
- [docs/06-DESIGN-SYSTEM.md](docs/06-DESIGN-SYSTEM.md): tokens, type, motion, components
- [docs/10-FORENSICS.md](docs/10-FORENSICS.md): every check, its severity and its limits
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) · [docs/adr/](docs/adr/)

## Credits and design sources

The landing and sign-in illustrations are the maintainer's own watercolours. Code and ideas from
elsewhere, and what was looked at but not used:

| Source | Used for | Licence |
|---|---|---|
| [PatternCraft](https://patterncraft.fun/) | The idea of CSS background patterns: the dot-grid placeholder behind maps and drop zones (written here, in the design tokens) | MIT |
| [itshover](https://www.itshover.com/icons) animated icons | The draw-once icon style: rings and marks that draw as they appear (written here as CSS stroke animation) | Apache-2.0 |
| Math curve loaders | The idea of a loader traced along a mathematical curve (rose, lissajous); written from the equations, not copied | Original repository unlicensed, so nothing taken |
| [21st.dev](https://21st.dev/) | Pattern research through its catalogue: a step checklist with pending, active, done and error states | Patterns only, no code |
| [Lucide](https://lucide.dev/) | Interface icons | ISC |
| OpenFreeMap, EOX Sentinel-2 cloudless, Sentinel-2 L2A via Element 84 Earth Search | Map tiles, imagery, satellite scenes | See their terms; attribution on every map |

Looked at and left out, on purpose: React Bits (MIT with the Commons Clause, which does not sit
with this repository's Apache-2.0 licence), Spline, Rive, ShaderGradient, LottieFiles and Icons8
(runtime weight of 250 KB to over 1 MB on pages a field team opens on a phone, or attribution
terms), and generated hero art (the hero is the maintainer's own illustration).

## Licence and authorship

Licensed under Apache-2.0 ([LICENSE](LICENSE)). All code and commits are by the repository owner.
