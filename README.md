# Delta-MRV: High-Integrity Autonomous Ecological Verification

**Delta-MRV** is an autonomous, tamper-proof Measurement, Reporting & Verification (MRV) platform designed to eliminate fraud in carbon offset and ecological grant disbursements (e.g., mangrove restoration across the Sundarbans ecological corridor).

Instead of relying on corruptible manual paper spreadsheets, PDF certifications, or unverified self-reported imagery, Delta cross-references **native PostGIS spatial geofences**, **perceptual image deduplication (`pgvector` + `dHash`)**, **3-tenant conflict-of-interest consensus**, and **Base Sepolia Merkle anchoring** with zero-trust in-browser verification.

```
PROJECT REGISTERED → EVIDENCE INTAKE → DETERMINISTIC FORENSICS → INDEPENDENT QUORUM → MERKLE ANCHOR → PUBLIC ZERO-TRUST PROOF
```

---

## What Delta Proves, and What It Does Not

### It proves
- The evidence file existed at a recorded point in time.
- The evidence has not changed since approval (cryptographic hash comparison against on-chain Merkle root).
- It passed stated consistency checks — PostGIS polygon containment, perceptual duplicate radar, EXIF plausibility.
- It was approved by named humans from an organisation independent of the claimant under a strict conflict-of-interest gate.
- The review history has not been silently rewritten (hash-chained audit log with trigger-enforced append-only tables).

### It does not prove
- That trees were actually planted, or that they survived indefinitely.
- That the photograph was taken where or when the EXIF says (GPS and timestamps can be spoofed; physical ground reality can diverge from digital records).
- Anything an AI model "observed" — AI findings are logged strictly as unprivileged advisory notes, never as proof.

*Independent physical ground auditing remains essential. A matching hash confirms record integrity; multi-tenant human consensus confirms evidentiary standards.*

---

## The 8 Core Production Features

### Part 1: The 4 Foundational Verification Pillars

| # | Core Feature | The Real-World Problem It Solves | Implementation in Delta |
|---|---|---|---|
| **1** | **Deterministic Forensic Intake & `pgvector` Duplicate Radar** | NGOs or contractors reusing the same sapling/cleanup photos across multiple grant milestones or different projects (double-dipping). | • Private blob storage with 5 MB cap.<br>• Server-side `sharp` computes SHA-256 + 64-bit `dHash` (`bit(64)`).<br>• `pgvector` Hamming distance query (`<~> 8`): Cross-project match = `HIGH` fraud alert; same-project match = `LOW` time-series signal.<br>• Compares `beforeDHash` vs `afterDHash` (`NO_VISIBLE_CHANGE` if distance < 4 bits). |
| **2** | **PostGIS Polygon Geofencing & Location Commitment** | Field photos taken at a commercial plant nursery 30 km away instead of inside the restoration plot — plus protecting endangered habitats from public coordinate scraping. | • Project boundaries stored as `geometry(Polygon, 4326)` in PostGIS.<br>• Evaluates `ST_Covers` and `ST_Distance` against extracted EXIF GPS.<br>• **Privacy Commitment:** Public routes display only a fuzzed centroid (~5.5 km grid cell) + `SHA256("DELTA_LOC_V1:" + saltHex + ":" + canonicalize(exactGeoJson))`. Exact coordinates are unlocked only by authorized auditors in the Evidence Lab. |
| **3** | **3-Tenant Conflict-of-Interest (COI) Engine & 2-of-N Quorum** | Self-certification ("grading your own homework") or a single compromised reviewer rubber-stamping fake claims. | • Better Auth organization multi-tenancy with strict tenant types: `OWNER_NGO`, `VERIFIER_AUDITOR`, `FUNDER_READONLY`.<br>• Service-layer guard throws `ConflictOfInterestError` if `actorOrgId === project.ownerOrgId`.<br>• Requires **2 distinct independent verifier signatures** (`2-of-N quorum`) with mandatory written justifications ($\ge 20$ chars) before a submission can be approved.<br>• **Blind-until-vote review:** Reviewers cannot see peers' votes until they have cast their own. |
| **4** | **Hash-Chained Audit Ledger & Base Sepolia Merkle Anchoring** | Silent database tampering (an administrator editing Postgres rows months later before a funder audit) and fake "Verified" badges that require trusting a server. | • Database-enforced append-only tables (`audit_event`, `review_decision`, `anchor_leaf`) where `UPDATE` and `DELETE` are revoked via triggers.<br>• 1-per-day OpenZeppelin `StandardMerkleTree` anchored to `ImpactAnchorRegistry.sol` on Base Sepolia (`84532`) via `viem`.<br>• **Zero-Trust Proof Dossier (`/proof/[id]`):** Strangers verify the Merkle proof directly in their own browser over `eth_call`.<br>• **Local Drop-Photo Verifier:** Anyone can drag-and-drop an original photo; browser WebCrypto hashes the file locally to prove it matches the anchored manifest byte-for-byte. |

### Part 2: The 4 Real-World Readiness Features

| # | Real-World Upgrade | The Real-World Reality It Handles | Implementation in Delta |
|---|---|---|---|
| **5** | **Disconnected Field Worker Resilience (Offline Vault & EXIF Pre-flight)** | Field officers taking photos in coastal mangrove belts or rural wetlands rarely have stable 4G when on-site; messaging apps silently strip EXIF metadata. | • **IndexedDB Field Vault (`delta_field_vault`):** Queues raw before/after photographs, client SHA-256 hashes, field observations, and GPS fixes on-device. Auto-recovers and syncs upon reconnection.<br>• **Client-Side EXIF Pre-Flight:** Native browser `exifr` warns field workers immediately if EXIF GPS is missing (*"Metadata stripped by WhatsApp/Telegram — camera original recommended"*). Displays sensor pills (`📷 Sony Alpha 7 IV`). |
| **6** | **Tamper-Evident Dispute & Remediation Loop** | Legitimate field workers being rejected outright due to a blurry photo, bad vantage angle, or obscured marker post without an audit trail for remediation. | • Formal `NEEDS_MORE_PROOF` state with 4 structured dispute codes: `[EXIF_STRIPPED]`, `[BOUNDARY_MARKER_NOT_VISIBLE]`, `[BLURRY_AFTER_PHOTO]`, `[SUSPECTED_CROSS_PLOT_OVERLAP]`.<br>• Project owners submit supplementary evidence (`role: SUPPLEMENT`) in remediation round $N+1$, triggering an incremental forensics pass while preserving historical rounds. |
| **7** | **Institutional Funder Compliance Export & Reverse Lookup** | Funder compliance officers and auditors requiring portable, machine-verifiable cryptographic archives that can be validated offline years later. | • **1-Click Cryptographic Verification Bundle (`.json`):** Exports the canonical RFC 8785 manifest, Merkle proof path, root, Base Sepolia transaction metadata, and review signatures.<br>• **Printable Proof Certificate:** Clean `@media print` certificate styling.<br>• **Reverse Proof Lookup (`/verify`):** Public reverse lookup tool accepting a proof ID, transaction hash, or dropped image file. |
| **8** | **Built-in Adversarial Fraud Simulator** | Grant committees, donors, and technical evaluators needing live proof that the platform actually catches sophisticated fraud attempts. | • Built directly into the intake interface under `DEMO_MODE=true`:<br>  - **Scenario A: Legitimate Sundarbans Mangrove Planting (`Clean Pass`)** — In-polygon coordinates (`21.9497° N, 89.1833° E`), valid Sony Alpha EXIF, genuine vegetative delta.<br>  - **Scenario B: Adversarial Cross-Project Double-Claim (`Duplicate Fraud`)** — Injects duplicate image bytes to trigger `pgvector` perceptual dHash collision (`< 4` bits).<br>  - **Scenario C: Adversarial Off-Site Nursery Spoof (`Boundary Violation`)** — Injects coordinates from a commercial plant nursery in Khulna city (28.4 km outside boundary) to trigger PostGIS `ST_Covers` failure. |

---

## Architectural Principles & Strict Rules

1. **Service Layer Pattern**: Domain logic lives exclusively in `src/server/services/`. Server Actions and route handlers are thin adapters (validate input with Zod, invoke one service, return response).
2. **Frozen Cryptography**: Core cryptographic primitives in `src/lib/crypto/` (RFC 8785 canonical serialization, `DELTA_LOC_V1` location commitments, and Merkle leaf hashing) are frozen to guarantee that old anchors verify forever across Node and browser runtimes.
3. **No AI in the Loop for Authority**: Multimodal AI produces advisory notes only. An AI model never approves, rejects, transitions submission states, or signs audit records.
4. **Living Earth Design System**: Two distinct themes driven by audience rather than toggles:
   - **Field Theme (`data-theme="field"`, `#0C1413`)**: Dark, instrument-panel workspace for field workers and auditors reviewing hundreds of submissions.
   - **Paper Theme (`data-theme="paper"`, `#F7F3EA`)**: Warm, generous certificate aesthetic for public proof dossiers and funder reviews.
5. **Zero External Paid APIs ($0/Month Constraint)**: Free-tier Postgres (Neon), Vercel Blob private storage, Base Sepolia testnet L2, and client-side browser WebCrypto.

---

## Routes Catalog (21 Routes)

```
Public Exploration & Verification (Paper Theme)
├── /                                Landing page, problem statement, live proof teaser
├── /atlas                           Impact Atlas with MapLibre GL GIS visualization
├── /p/[id]                          Public project overview with fuzzed geometry
├── /proof/[id]                      Canonical public proof dossier with client-side Merkle verifier
├── /verify                          Public reverse proof lookup (ID, tx hash, or dropped photo)
└── /trust                           Trust & limits disclosure, forensics rule table, ADR catalog

Workspace & Audit Console (Field Theme)
├── /dashboard                       Role-adaptive workspace (Owner, Verifier, Funder metrics)
├── /projects/[id]                   Authenticated project management with exact boundary & salt
├── /projects/[id]/submit            Before/after photographic intake & offline vault
├── /lab                             Evidence Lab review queue with 2-of-N quorum voting
├── /demo                            1-click seeded persona switcher (Demo mode only)
├── /sign-in                         Multi-tenant authentication
└── /sign-up                         Organization registration

API Endpoints
├── /api/auth/[...all]               Better Auth handler
├── /api/evidence/[fileId]           Scoped evidence image stream
├── /api/submissions                Draft creation
├── /api/submissions/[id]/upload-token Private blob scoped upload tokens
├── /api/submissions/[id]/finalize   Atomic transaction finalizing intake & triggering forensics
├── /api/submissions/[id]/supplement Remediation supplement upload (round N+1)
├── /api/submissions/[id]/findings   Forensics findings stream
├── /api/lab/decision                Reviewer decision recording (COI guarded)
├── /api/lab/queue                   Assigned verifier review queue
├── /api/internal/jobs/drain         Postgres job queue drain worker
└── /api/v1/projects                 Public project metadata API
```

---

## Tech Stack

- **Framework**: Next.js 16.4.3 (App Router, Turbopack, Partial Prerendering) + React 19
- **Database & ORM**: PostgreSQL with PostGIS (`v3.6.4`) + pgvector (`v0.8.6`) via Drizzle ORM (`0.45.4`) and `postgres.js` over TCP
- **Authentication**: Better Auth (`1.7.13`) with multi-tenant organization plugin
- **Image Forensics & Telemetry**: `sharp` (dHash calculation), `exifr` (EXIF/GPS extraction in browser & Node)
- **Web3 & Anchoring**: Base Sepolia (`84532`), OpenZeppelin `StandardMerkleTree`, `viem` (`2.57.11`), Foundry (`ImpactAnchorRegistry.sol`)
- **Cartography**: MapLibre GL (`5.24.0`)
- **Styling**: Tailwind CSS v4 + Shadcn UI primitives + Lucide Icons

---

## Getting Started

### 1. Prerequisites
- **Node.js**: `>=22`
- **pnpm**: `pnpm@11.28.10`
- **PostgreSQL**: Postgres 16+ instance with PostGIS and pgvector extensions enabled (e.g. Neon)

### 2. Environment Configuration
Copy the configuration template and configure your local environment:

```bash
cp .env.example .env.local
```

Key environment variables defined in `.env.example`:
- `DATABASE_URL`: PostgreSQL connection string using `postgres.js` over TCP (never serverless HTTP)
- `BETTER_AUTH_SECRET`: Random 32+ character authentication secret
- `BETTER_AUTH_URL`: Local or production application origin (`http://localhost:3000`)
- `BLOB_READ_WRITE_TOKEN`: Private Vercel Blob store token for raw evidence photos
- `BASE_SEPOLIA_RPC_URL`: JSON-RPC provider endpoint for Base Sepolia testnet
- `NEXT_PUBLIC_CHAIN_ID`: Target EVM network identifier (`84532` for Base Sepolia)
- `DEMO_MODE`: Set to `"true"` to enable 1-click persona switching and fraud simulator

### 3. Database Migration & Seed
```bash
# Apply Drizzle migrations (creates PostGIS and pgvector tables)
pnpm db:migrate

# Seed demo organisations, projects, and baseline evidence pool
pnpm db:seed
```

### 4. Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to access the landing page, [http://localhost:3000/atlas](http://localhost:3000/atlas) for the Impact Atlas, or [http://localhost:3000/demo](http://localhost:3000/demo) to switch between NGO, Verifier, and Funder personas.

---

## Verification & Testing Suite

Delta enforces strict quality gates before every commit:

```bash
# Full test and static analysis suite (Unit tests + TypeScript + ESLint + Forbidden deps)
pnpm check

# PostGIS, pgvector, multi-tenant tenancy, and forensics integration suite
pnpm test:integration

# Next.js 16 production build across all 21 routes with Partial Prerendering
pnpm build
```

---

## License & Authorship

All commits and code authored by **Shoumik Orgho** (`orghodutta@gmail.com`). Licensed under the Apache-2.0 License.
