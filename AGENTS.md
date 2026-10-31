<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Delta-MRV Architectural & Stack Directives

### Stack Restrictions
- **Target Stack**: Next.js 16 (App Router), React 19, Drizzle ORM, and Better Auth.
- **DO NOT** install or use Prisma.
- **DO NOT** install or use NextAuth.js / Auth.js (use Better Auth).
- **DO NOT** use AWS for storage (use free-tier compatible S3 like Cloudflare R2 via `@aws-sdk/client-s3`).
- **DO NOT** use MongoDB. Use Neon Serverless Postgres with `pgvector` and `PostGIS`.

### Required Architectural Skills
1. **Backend (Drizzle Spatial/Vector Ops)**: When writing Drizzle ORM schemas for Delta, use `customType` for PostGIS `geometry` and `pgvector` `bit` columns. For distance queries, you must use raw `sql` fragments for `ST_Contains`, `ST_DWithin`, and `<~>` (Hamming distance on `bit` columns; `<->` is for vector Euclidean L2 distance). Never pull full datasets into Node.js to calculate distances in memory.
2. **Backend (Service Layer Pattern)**: Server Actions in Next.js 16 are purely UI adapters. You must place all core business logic (forensics, anchoring, DB writes) inside `src/server/services/`. Server actions only validate Zod payloads, call the service layer, and return a `{ data, error }` object.
3. **Frontend (MapLibre + Shadcn Integration)**: When designing the Impact Atlas, ensure `react-map-gl` is the base layer. All floating UI panels, filter pills, and telemetry drawers must use `shadcn/ui` components structured with Tailwind `absolute` positioning layered over the map canvas. Always use `[longitude, latitude]` array ordering for MapLibre GeoJSON compliance.
4. **Frontend (Living Earth Design Tokens)**: Enforce the Delta color palette strictly. Use `#101A18` for dark mode backgrounds, `#172623` for elevated cards, and `#D7F6B8` for primary buttons and active verification states. Use `Geist_Mono` with `tabular-nums` for all rendered coordinates, risk scores, and cryptographic hashes.
