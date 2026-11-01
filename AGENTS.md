<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENT DIRECTIVE: DELTA-MRV SYSTEM ARCHITECTURE & CODING STANDARDS

## 1. Project Overview & Mission
**Delta-MRV** is an autonomous, high-integrity Measurement, Reporting & Verification (MRV) platform designed to eliminate fraud in carbon offset and ecological restoration projects (e.g., mangrove restoration in the Sundarbans).
It automates tamper-proof verification by cross-referencing:
1. **Physical Grounding**: PostGIS geofencing ensuring evidence originated within actual project boundaries.
2. **Duplicate Prevention**: 64-bit dHash perceptual hashing with database-level Hamming distance (`<~>`) to prevent photo recycling.
3. **AI Forensics**: Gemini 2.5 Flash evaluating canopy health, vegetation density, and detecting screen recaptures/spoofing.
4. **Multi-Tenant Trust**: Better Auth with organizations for Project Developers, Field Verifiers, and Auditors.
5. **Cost Mandate**: Built entirely on free-tier, open-source infrastructure ($0/month operating cost).

---

## 2. Hard Stack Restrictions & Directives
- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4.
- **ORM & DB**: Drizzle ORM on Neon Serverless Postgres with `postgis` (v3.6.4) and `vector` (v0.8.6).
  - **DO NOT** install or use Prisma.
  - **DO NOT** install or use MongoDB.
- **Authentication**: Better Auth with Drizzle Postgres adapter and Organization plugin.
  - **DO NOT** install or use NextAuth.js / Auth.js.
- **Storage**: Local zero-cost storage provider (`src/server/services/storage.service.ts`) writing to `public/uploads/`.
  - **DO NOT** use AWS S3 (use S3-compatible APIs like Cloudflare R2 only if cloud credentials are explicitly provided).

---

## 3. Core Architectural Rules

### Rule 1: Service Layer Pattern (Strict Separation)
- Server Actions in `app/actions/` are **strictly UI adapters**.
- **All business logic**, database mutations, image processing, AI calls, and EXIF extraction must live in `src/server/services/`.
- Server Actions must only:
  1. Validate incoming input using Zod.
  2. Call the service layer (`src/server/services/`).
  3. Return a standardized `{ data, error }` object.

### Rule 2: Drizzle Spatial & Vector Operations
- Always use `customType` for PostGIS `geometry` and `pgvector` `bit` columns in `src/server/db/schema.ts`.
- **Database-Level Distance**:
  - Distance and geofence queries **must** use raw `sql` fragments: `ST_Contains`, `ST_DWithin`.
  - For perceptual hash duplicate detection on `bit(64)` columns, use `<~>` (Hamming distance):
    `sql` SELECT id, (d_hash <~> ${dHash}::bit(64)) AS distance FROM verification_events ... `
  - **Note**: `<->` in pgvector is for Euclidean L2 distance on vector types. `<~>` is for Hamming distance on bit types.
  - **Never** pull datasets into Node.js memory to compute spatial or Hamming distances.
- **Coordinates Ordering**: Always enforce `[longitude, latitude]` for MapLibre/GeoJSON compliance.

### Rule 3: Database Connection & Migrations
- Web/app query traffic uses pooled `DATABASE_URL` (`@neondatabase/serverless` over HTTP).
- Migrations use direct/unpooled `DATABASE_URL_UNPOOLED` (`npm run db:migrate`).
- Connection strings must strip TCP-only `channel_binding=require` before passing to `@neondatabase/serverless` HTTP fetch.
- `src/server/db/index.ts` must provide a fallback placeholder so module evaluation during dry builds or CI never throws.

### Rule 4: Frontend MapLibre + Shadcn Integration
- Base map layer: `react-map-gl` with `maplibre-gl`.
- All floating controls, filter pills, and telemetry panels must use `shadcn/ui` components structured with Tailwind `absolute` positioning layered over the map canvas.
- No Mapbox access tokens required — use free/open vector tiles (e.g. CARTO basemaps or OpenStreetMap).

### Rule 5: Living Earth Design Tokens
- Dark Mode Background: `#101A18`
- Elevated Surfaces / Cards: `#172623`
- Primary / Verified Accent: `#D7F6B8`
- Telemetry Typography: Use `font-mono tabular-nums` (Geist_Mono) for all rendered coordinates, risk scores, hashes, and latencies.

---

## 4. Key Directory & File Map

```text
d:/Delta-MRV/
├── .agents/
│   ├── mcp_config.json                 # MCP servers (Postgres, Neon, Brave Search)
│   └── skills/                         # On-demand modular skills
├── app/
│   ├── actions/                        # UI Adapters (Server Actions)
│   │   ├── database.ts                 # Database telemetry check action
│   │   └── evidence.ts                 # Evidence intake & upload action
│   ├── api/
│   │   ├── auth/[...all]/route.ts      # Better Auth route handler
│   │   └── health/neon/route.ts        # Database health check endpoint
│   ├── globals.css                     # Tailwind v4 theme & shadcn tokens
│   ├── layout.tsx                      # Root layout, Geist fonts, TooltipProvider
│   └── page.tsx                        # Main dashboard & live verification studio
├── components/
│   ├── evidence-uploader.tsx           # Client-side evidence submission studio
│   └── ui/                             # 15 Atomic Shadcn UI primitives
├── drizzle/                            # Generated SQL migration files
├── lib/
│   └── utils.ts                        # cn() helper using clsx + tailwind-merge
├── public/
│   └── uploads/                        # Local evidence storage (zero-cost)
├── src/
│   ├── lib/
│   │   ├── auth.ts                     # Better Auth server configuration
│   │   └── auth-client.ts              # Better Auth client hooks (useSession, signIn)
│   └── server/
│       ├── db/
│       │   ├── index.ts                # Neon HTTP Drizzle client & connection sanitizer
│       │   ├── schema.ts               # PostGIS & pgvector custom types & verification table
│       │   └── auth-schema.ts          # Better Auth users, sessions & organizations
│       └── services/
│           ├── database.service.ts     # Live Postgres telemetry & extension checker
│           ├── forensics.service.ts    # SHA-256, dHash, EXIF, <~> duplicate check, Gemini audit
│           └── storage.service.ts      # Local zero-cost storage provider
├── AGENTS.md                           # This single central directive file
└── package.json                        # Dependencies and db scripts
```

---

## 5. Standard CLI Workflows
- **Start Dev Server**: `npm run dev` (runs on http://localhost:3000)
- **Production Build**: `npm run build` (Next.js 16 Partial Prerendering & Cache Components)
- **Generate Migrations**: `npm run db:generate` (Drizzle Kit parses `schema.ts`)
- **Apply Migrations**: `npm run db:migrate` (Applies `./drizzle/*.sql` over direct Neon URL)
