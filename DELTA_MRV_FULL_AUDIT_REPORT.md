# DELTA-MRV: COMPREHENSIVE PROJECT AUDIT & SYSTEM STATUS REPORT
**Generated:** November 2, 2026 | **Branch:** `main` | **Engine:** Next.js 16 (App Router) + React 19 + TypeScript 5

---

## 1. Executive Summary & Mission

**Delta-MRV** is an autonomous, high-integrity Measurement, Reporting & Verification (MRV) platform designed to eradicate greenwashing and fraud in ecological restoration and carbon offset projects (specifically calibrated for mangrove restoration in the Sundarbans Delta, Bangladesh).

The platform enforces verification integrity across four pillars:
1. **Physical Grounding**: PostGIS geospatial validation (SRID 4326) guaranteeing evidence originates within legally demarcated project boundaries.
2. **Perceptual Duplicate Prevention**: 64-bit Difference Hashing (`dHash`) with database-level Hamming distance (`<~>`) computed directly in PostgreSQL via `pgvector` to detect recycled/recompressed photos.
3. **Multimodal AI Forensics**: Google Gemini 2.5 Flash evaluating canopy health, vegetation density %, taxonomic species identification, and anti-spoofing/screen-recapture detection.
4. **Multi-Tenant Trust**: Better Auth with organizations for three distinct roles: Project Developers (`OWNER`), Field Verifiers (`VERIFIER`), and Carbon/Ecological Auditors (`FUNDER`).
5. **Cost Mandate**: Designed to run at **$0/month infrastructure cost** utilizing Neon Serverless Postgres free tier, local zero-cost storage, and free open vector tiles.

---

## 2. Git Commit History (Chronological & Detailed)

Every commit in the project repository represents a distinct architectural milestone:

```
c19d36c (HEAD -> main, origin/main) docs: consolidate central AGENTS.md directive, remove deprecated Dependencies_Agent.md, and update README
d837530 feat(forensics): implement multimodal forensics, local storage, and evidence verification studio
1a31bdc feat(auth): configure Better Auth with Drizzle adapter and Organization plugin
55dfbe4 feat: initialize stack, Neon Postgres, PostGIS, pgvector, shadcn UI, and database telemetry
0427d58 Initial commit from Create Next App
```

### Commit 1: `0427d58` — Initial commit from Create Next App
- **Date**: Wed Oct 28 17:13:56 2026
- **Author**: Shoumik Orgho (`orghodutta@gmail.com`)
- **Key Files**: `package.json`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `eslint.config.mjs`, `next.config.ts`.
- **Purpose**: Base scaffolding for Next.js 16 with React 19, TypeScript 5, and Turbopack.

### Commit 2: `55dfbe4` — Stack Initialization, Neon Postgres, PostGIS, pgvector, shadcn UI, Database Telemetry
- **Date**: Sun Nov 1 01:24:35 2026
- **Author**: Shoumik Orgho (`orghodutta@gmail.com`)
- **Key Additions**:
  - Configured `@neondatabase/serverless` over HTTP with Drizzle ORM (`drizzle-orm/neon-http`).
  - Added connection string sanitizer to strip TCP-only `channel_binding=require` for serverless environments.
  - Implemented custom Drizzle column types for PostGIS `geometry(Point, 4326)` and pgvector `bit(64)`.
  - Defined initial schema table `verification_events`.
  - Added database setup scripts (`scripts/setup-db.ts` to enable `postgis` and `vector` extensions; `scripts/migrate.ts` for running Drizzle migrations).
  - Generated and applied initial migration `drizzle/0000_remarkable_kulan_gath.sql`.
  - Implemented `src/server/services/database.service.ts` to inspect live Neon metadata, latency, and extensions.
  - Implemented Server Action `app/actions/database.ts` (`checkNeonConnectionAction`).
  - Implemented Health Check API `app/api/health/neon/route.ts`.
  - Installed 15 atomic shadcn UI components (`components/ui/*`).
  - Configured Tailwind CSS v4 with Living Earth design tokens (`#101A18`, `#172623`, `#D7F6B8`).
  - Added 4 specialized agent skills under `.agents/skills/`.

### Commit 3: `1a31bdc` — Better Auth with Drizzle Adapter & Organization Plugin
- **Date**: Sun Nov 1 01:32:44 2026
- **Author**: Shoumik Orgho (`orghodutta@gmail.com`)
- **Key Additions**:
  - Implemented `src/server/db/auth-schema.ts` defining Better Auth tables: `user`, `session`, `account`, `verification`, `organization`, `member`, and `invitation` with foreign key cascades and relations.
  - Configured Better Auth server (`src/lib/auth.ts`) with Drizzle Postgres adapter and Organization plugin.
  - Created Better Auth client (`src/lib/auth-client.ts`) with Organization client hooks (`useSession`, `signIn`, `signUp`, `signOut`, `organizationActions`).
  - Implemented wild-card route handler `app/api/auth/[...all]/route.ts` bridging Better Auth to Next.js App Router.
  - Generated and committed Drizzle migration `drizzle/0001_foamy_shadowcat.sql`.

### Commit 4: `d837530` — Multimodal Forensics, Local Storage, and Verification Studio
- **Date**: Sun Nov 1 01:49:33 2026
- **Author**: Shoumik Orgho (`orghodutta@gmail.com`)
- **Key Additions**:
  - Implemented `src/server/services/storage.service.ts`: zero-cost local file storage saving to `public/uploads/{subfolder}/{uuid}.{ext}`.
  - Implemented `src/server/services/forensics.service.ts`:
    - `computeSha256`: Node.js crypto SHA-256 cryptographic digest.
    - `computeDHash`: Sharp-powered 64-bit perceptual difference hash (9x8 grayscale gradient comparison).
    - `extractExifTelemetry`: Exifr-powered GPS (lat/long), timestamp, and device metadata extraction.
    - `checkPerceptualDuplicates`: Raw SQL query using `<~>` Hamming distance operator on `bit(64)` column in Neon PostgreSQL.
    - `evaluateEcologicalImagery`: Gemini 2.5 Flash multimodal audit (canopy health, density %, species identification, anti-spoofing).
    - `processEvidenceSubmission`: Complete service pipeline orchestrating hashing, EXIF, AI, duplicate checking, local storage, and database persistence.
  - Implemented Server Action `app/actions/evidence.ts` (`submitEvidenceAction`).
  - Implemented UI Studio `components/evidence-uploader.tsx` with live telemetry display.
  - Rebuilt `app/page.tsx` into a live Mission Control Dashboard with telemetry card and evidence intake.

### Commit 5: `c19d36c` — Directive Consolidation & Central Standard
- **Date**: Sun Nov 1 12:19:14 2026
- **Author**: Shoumik Orgho (`orghodutta@gmail.com`)
- **Key Additions**:
  - Unified project directives into `AGENTS.md`.
  - Deprecated legacy `Dependencies_Agent.md`.
  - Updated `README.md` with full architecture, environment variables, and CLI workflows.

---

## 3. Directory & File Inventory

```text
d:/Delta-MRV/
├── .agents/
│   ├── mcp_config.json                         # Model Context Protocol servers (Postgres, Neon, Brave)
│   └── skills/                                 # Antigravity modular skills
│       ├── drizzle-spatial-vector-ops/         # Drizzle custom types & PostGIS/pgvector ops
│       ├── living-earth-design-tokens/         # Living Earth design system & monospace tokens
│       ├── maplibre-shadcn-integration/        # Cartographic UI integration directives
│       └── service-layer-pattern/              # Strict UI/Service layer separation pattern
├── app/
│   ├── actions/
│   │   ├── database.ts                         # UI Adapter: Neon database telemetry check
│   │   └── evidence.ts                         # UI Adapter: Multi-part evidence intake & upload
│   ├── api/
│   │   ├── auth/[...all]/route.ts              # Better Auth REST endpoint router
│   │   └── health/neon/route.ts                # HTTP GET endpoint for database & extension health
│   ├── favicon.ico
│   ├── globals.css                             # Tailwind v4 theme, CSS variables & shadcn tokens
│   ├── layout.tsx                              # Root layout with Geist fonts & TooltipProvider
│   └── page.tsx                                # Main verification studio & live telemetry dashboard
├── components/
│   ├── evidence-uploader.tsx                   # Client-side evidence submission & auditing studio
│   └── ui/                                     # 15 Atomic Shadcn UI primitives
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       ├── sonner.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── delta-mrv-scope/                            # Master Project Specification & Roadmap documentation
│   ├── docs/
│   │   ├── adr/                                # 5 Architecture Decision Records (ADR-0001 to 0005)
│   │   ├── 00-PRODUCT.md                       # Product vision and core problem definition
│   │   ├── 01-FEATURE-LOCK.md                  # MUST/SHOULD/STRETCH/CUT feature lock
│   │   ├── 02-ARCHITECTURE.md                  # Modular monolith layer architecture
│   │   ├── 03-DATABASE.md                      # Complete database schema design
│   │   ├── 04-AUTH.md                          # Better Auth & role-based tenancy design
│   │   ├── 05-ROUTES.md                        # Master route catalogue & access guards
│   │   ├── 06-DESIGN-SYSTEM.md                 # Design system (Field vs Paper themes)
│   │   ├── 07-DEPENDENCIES.md                  # Approved dependencies & forbidden list
│   │   ├── 08-AI.md                            # Gemini 2.5 Flash audit integration
│   │   ├── 09-WEB3.md                          # Base Sepolia Merkle anchoring & contracts
│   │   ├── 10-FORENSICS.md                     # Multimodal forensic pipeline specification
│   │   ├── 11-IMPLEMENTATION.md                # Stage-by-stage implementation roadmap
│   │   ├── 12-AGENT-SCOPE.md                   # Agent guardrails and operational rules
│   │   ├── DEPENDENCY_LOG.md                   # Package registry audit log
│   │   └── THREAT_MODEL.md                     # Threat model & attack surface analysis
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   └── INSTALL.md
├── drizzle/                                    # Generated SQL migration files
│   ├── 0000_remarkable_kulan_gath.sql          # Creates verification_events table
│   ├── 0001_foamy_shadowcat.sql                # Creates Better Auth & Org tables and indices
│   └── meta/                                   # Drizzle snapshots & journal
├── lib/
│   └── utils.ts                                # Standard `cn` helper (clsx + tailwind-merge)
├── public/
│   ├── uploads/                                # Local zero-cost evidence asset storage
│   ├── file.svg, globe.svg, next.svg, etc.     # Brand icons
├── scripts/
│   ├── migrate.ts                              # Direct database migration executor
│   └── setup-db.ts                             # PostGIS & pgvector extension activator
├── src/
│   ├── lib/
│   │   ├── auth.ts                             # Server Better Auth configuration
│   │   └── auth-client.ts                      # Client Better Auth hooks & org actions
│   └── server/
│       ├── db/
│       │   ├── index.ts                        # Neon HTTP Drizzle client & URL sanitizer
│       │   ├── schema.ts                       # PostGIS & pgvector custom types & verification table
│       │   └── auth-schema.ts                  # Better Auth schema, organizations & relations
│       └── services/
│           ├── database.service.ts             # Database telemetry & extension inspector
│           ├── forensics.service.ts            # Multimodal forensics, dHash, EXIF, AI, Hamming check
│           └── storage.service.ts              # Local zero-cost file storage provider
├── AGENTS.md                                   # Central agent instructions & architectural rules
├── components.json                             # Shadcn UI configuration
├── drizzle.config.ts                           # Drizzle Kit configuration
├── eslint.config.mjs                           # ESLint configuration
├── neon.ts                                     # Neon environment helper
├── next.config.ts                              # Next.js configuration
├── package.json                                # Project dependencies and CLI scripts
├── README.md                                   # Project documentation and quickstart
└── tsconfig.json                               # TypeScript configuration
```

---

## 4. Implemented Routes & API Endpoints

### 4.1 UI Routes
| Route | Type | Component | Description |
|---|---|---|---|
| `/` | Server Component | `app/page.tsx` | **Mission Control Verification Studio**: Renders the application header, live `NeonTelemetryPanel` (streaming latency, extensions, branch, and role), and the interactive `EvidenceUploader` client studio. |

### 4.2 Server Actions (UI Adapters in `app/actions/`)
| Action Name | File | Input Schema | Purpose |
|---|---|---|---|
| `checkNeonConnectionAction` | `app/actions/database.ts` | `{ source?: string }` | Validates input via Zod, calls `database.service.ts`, returns `{ data: NeonTelemetry, error }`. |
| `submitEvidenceAction` | `app/actions/evidence.ts` | `FormData` (file, projectSlug, longitude, latitude) | Parses multipart form data, validates via Zod, calls `processEvidenceSubmission` in `forensics.service.ts`, returns `{ data: EvidenceProcessingResult, error }`. |

### 4.3 HTTP API Route Handlers (in `app/api/`)
| Endpoint | Method | File | Purpose |
|---|---|---|---|
| `/api/auth/[...all]` | `GET`, `POST` | `app/api/auth/[...all]/route.ts` | Better Auth endpoint handler managing user signup, login, session tokens, invitations, and organization switching. |
| `/api/health/neon` | `GET` | `app/api/health/neon/route.ts` | Health check endpoint returning JSON status of Neon PostgreSQL connectivity, query latency, and active extensions (`postgis`, `vector`, `neon`). |

---

## 5. Database Architecture & Schemas

### 5.1 Custom Drizzle Column Types (`src/server/db/schema.ts`)
1. **`geometryPoint`**:
   - PostgreSQL Data Type: `geometry(Point, 4326)` (PostGIS).
   - Driver Data: Formats coordinates as `SRID=4326;POINT(longitude latitude)`.
   - Parser: Parses WKT, EWKB hex buffers, or GeoJSON coordinates, strictly enforcing `[longitude, latitude]` ordering.
2. **`bit64`**:
   - PostgreSQL Data Type: `bit(64)` (pgvector).
   - Stores exactly 64-bit perceptual hash binary strings (`0` and `1`).

### 5.2 Verification Table (`verification_events`)
| Column Name | SQL Type | Drizzle Type | Modifiers / Default | Description |
|---|---|---|---|---|
| `id` | `serial` | `serial` | Primary Key, Not Null | Unique event identifier |
| `project_slug` | `text` | `text` | Not Null | Identifier for the project (e.g. `sundarbans-mangroves`) |
| `sha256_hash` | `text` | `text` | Not Null | Exact cryptographic hash of uploaded file |
| `d_hash` | `bit(64)` | `bit64` | Nullable | 64-bit Difference Hash for perceptual similarity |
| `location` | `geometry(Point, 4326)` | `geometryPoint` | Nullable | PostGIS coordinate point `[lon, lat]` |
| `risk_score` | `double precision` | `doublePrecision` | Not Null, Default `0` | Calculated composite risk score (0.00 to 1.00) |
| `created_at` | `timestamp with time zone`| `timestamp` | Not Null, Default `now()` | Ingestion timestamp with timezone |

### 5.3 Better Auth & Multi-Tenancy Tables (`src/server/db/auth-schema.ts`)
- **`user`**: `id`, `name`, `email` (unique), `email_verified`, `image`, `created_at`, `updated_at`.
- **`session`**: `id`, `token` (unique), `user_id` (FK -> `user.id`), `active_organization_id`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at`.
- **`account`**: `id`, `user_id` (FK -> `user.id`), `provider_id`, `account_id`, `password`, tokens, `created_at`, `updated_at`.
- **`verification`**: `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`.
- **`organization`**: `id`, `name`, `slug` (unique), `logo`, `created_at`, `metadata`.
- **`member`**: `id`, `organization_id` (FK -> `organization.id`), `user_id` (FK -> `user.id`), `role` (default `"member"`), `created_at`.
- **`invitation`**: `id`, `organization_id` (FK -> `organization.id`), `email`, `role`, `status` (`pending`), `inviter_id` (FK -> `user.id`), `expires_at`, `created_at`.
- Full Drizzle relations configured across all entities enabling relational queries via `db.query`.

---

## 6. Service Layer Implementation (`src/server/services/`)

### 6.1 `database.service.ts`
- **Function**: `getNeonTelemetry(): Promise<NeonTelemetry>`
- Executes raw queries against PostgreSQL to fetch:
  - Current database and authenticated role.
  - PostgreSQL version (`split_part(version(), ',', 1)`).
  - Current server timestamp.
  - Active extensions filtered by `vector`, `postgis`, `pg_stat_statements`, `neon`.
  - Measures execution latency in milliseconds (`performance.now()`).
  - Reports whether pooled connection or direct unpooled connection is active.

### 6.2 `storage.service.ts`
- **Class**: `LocalStorageService` (exported singleton `storageService`)
- Provides zero-cost, zero-dependency asset persistence for local development.
- Writes files to `public/uploads/{subfolder}/{uuid}.{ext}`.
- Guarantees directory creation via `fs.mkdir({ recursive: true })`.
- Returns public URL `/uploads/{subfolder}/{uuid}.{ext}` and byte size.

### 6.3 `forensics.service.ts`
Contains the core algorithmic verification pipeline:
1. **`computeSha256(buffer: Buffer): string`**
   - Cryptographic SHA-256 digest using Node.js `node:crypto`.
2. **`computeDHash(buffer: Buffer): Promise<string>`**
   - Resizes photo to 9x8 pixels (72 pixels total), converts to grayscale, and reads raw byte values via `sharp`.
   - Iterates through 8 rows and compares each adjacent pair (`left > right ? '1' : '0'`).
   - Produces an exact 64-bit binary perceptual signature.
3. **`extractExifTelemetry(buffer: Buffer): Promise<ExifTelemetry>`**
   - Parses EXIF and TIFF headers via `exifr`.
   - Extracts GPS coordinates (`latitude`, `longitude`), `DateTimeOriginal`, and camera `Make` + `Model`.
4. **`checkPerceptualDuplicates(dHash: string, maxHammingDistance = 10): Promise<DuplicateDetectionResult>`**
   - Queries `verification_events` using pgvector's Hamming distance operator (`<~>`) on `bit(64)`:
     ```sql
     SELECT id, (d_hash <~> ${dHash}::bit(64)) AS distance
     FROM verification_events
     WHERE d_hash IS NOT NULL
       AND (d_hash <~> ${dHash}::bit(64)) <= ${maxHammingDistance}
     ORDER BY distance ASC
     LIMIT 1;
     ```
   - Flags recycled photos if Hamming distance is $\le 10$ bits out of 64.
5. **`evaluateEcologicalImagery(buffer: Buffer, mimeType: string): Promise<GeminiForensicsAssessment>`**
   - Dispatches base64 image payload to **Gemini 2.5 Flash** (`@google/generative-ai`).
   - Evaluates:
     - `canopyHealth`: `"thriving"` | `"recovering"` | `"degraded"` | `"indeterminate"`
     - `vegetationDensityPct`: 0 to 100%
     - `speciesIdentified`: Array of biological species (e.g., *Rhizophora mangle*, *Avicennia marina*)
     - `authenticityAssessment`: Qualitative reasoning text
     - `antiSpoofingPassed`: Boolean detecting screen recaptures, AI deepfakes, or stock images
     - `riskScore`: Numerical risk between 0.00 (clean) and 1.00 (fraudulent)
6. **`processEvidenceSubmission(...)`**
   - Integrates all steps: hashes image, runs duplicate check, extracts EXIF, invokes Gemini, uploads to storage, computes composite risk score (penalizing duplicate hits and spoof failures), and commits the record to Neon PostgreSQL.

---

## 7. Frontend UI & Design System

- **Design System**: Living Earth Tokens
  - Dark Earth Background: `#101A18`
  - Elevated Container / Card Background: `#172623`
  - Verified Green Accent: `#D7F6B8`
  - Telemetry Typography: `font-mono tabular-nums` (Geist Mono) for all hashes, coordinates, risk scores, and latencies.
- **Components**:
  - `components/evidence-uploader.tsx`: Interactive client form supporting file selection, project slug override, fallback coordinates, loading state with spinner (`Cpu` icon), and authenticated result breakdown.
  - `app/page.tsx`: Mission Control layout with live telemetry card, dynamic indicators for `GEMINI 2.5 FLASH ACTIVE` and `POSTGIS 3.6 + PGVECTOR`, and React Suspense boundary.
  - 15 atomic UI components in `components/ui/` built on Tailwind CSS v4 and Radix/Base-UI primitives.

---

## 8. Current Implementation vs. Roadmap (`delta-mrv-scope`)

The repository currently includes the master architectural specification in `delta-mrv-scope/docs/`. Here is the exact status of each specification milestone:

| Stage / Feature | Specification Ref | Implementation Status | Details |
|---|---|---|---|
| **PostGIS & pgvector Setup** | M1, Stage 1 | **COMPLETED** | Extensions active in Neon, custom types defined, migration 0000 applied. |
| **Database Telemetry** | Stage 1 | **COMPLETED** | `getNeonTelemetry` service, Server Action, and `/api/health/neon` route live. |
| **Better Auth + Organizations** | M1, M3, Stage 1 | **COMPLETED (Schema & Config)** | `auth-schema.ts`, Better Auth routes, Drizzle adapter, client hooks created. |
| **Multimodal Forensics (dHash & EXIF)** | M7, Stage 4 | **COMPLETED** | Sharp 64-bit dHash, Exifr GPS extraction, and pgvector `<~>` duplicate check live. |
| **Gemini 2.5 Flash Forensics** | S2, Stage 5 | **COMPLETED** | AI canopy health, density, species identification, and anti-spoofing live. |
| **Evidence Intake Studio** | Stage 4 | **COMPLETED** | `evidence-uploader.tsx` studio live with instant verification feedback. |
| **Zero-Cost Storage Provider** | M5 | **COMPLETED** | `storage.service.ts` writing to `public/uploads/` at $0 cost. |
| **Impact Atlas (`/atlas`)** | M4, Stage 3 | **PENDING** | MapLibre GL JS v5 interactive map over project boundaries to be built. |
| **Evidence Lab Reviewer Workspace (`/lab`)** | M9, Stage 5 | **PENDING** | Reviewer queue with keyboard shortcuts (`j`/`k`/`a`/`r`) and 2-of-N quorum. |
| **Public Proof Dossier (`/proof/[id]`)** | M12, Stage 6 | **PENDING** | Warm Paper certificate with client-side Merkle proof verification. |
| **Hash-Chained Audit Log** | M10, Stage 5 | **PENDING** | PostgreSQL advisory-locked append-only RFC 8785 canonical hash chain. |
| **Base Sepolia Merkle Anchoring** | M11, Stage 6 | **PENDING** | Smart contract `ImpactAnchorRegistry.sol` and OpenZeppelin Merkle tree batching. |
| **Postgres Job Queue (`SKIP LOCKED`)**| M6, Stage 4 | **PENDING** | Async queue worker for decoupling heavy forensic pipelines. |
| **Offline PWA Field Capture** | M14, Stage 4 | **PENDING** | IndexedDB offline queue with client-side SHA-256 hashing. |

---

## 9. Verification & Code Quality Status

- **TypeScript Compilation**: `npx tsc --noEmit` runs with **0 errors**.
- **ESLint**: Strict Next.js 16 flat configuration active.
- **Database Connection**: Live verified against Neon Serverless Postgres with `postgis 3.6.4` and `vector 0.8.6`.
- **Environment**: Configured via `.env.local` (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GEMINI_API_KEY`).

