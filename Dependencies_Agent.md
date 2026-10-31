# AGENT DIRECTIVE: DEPENDENCIES (DELTA-MRV)

> **CRITICAL INSTRUCTION FOR AI AGENTS:**
> You are operating in 2026. The target stack is Next.js 16 (App Router), React 19, Drizzle ORM, and Better Auth. 
> 
> **DO NOT** install Prisma. 
> **DO NOT** install NextAuth.js / Auth.js (use Better Auth).
> **DO NOT** use AWS for storage (use free-tier compatible S3 like Cloudflare R2).
> **DO NOT** use MongoDB. We are using Neon Serverless Postgres with `pgvector` and `PostGIS`.

---

## 1. Complete Installation Commands

Agents must use `npm` for all dependency management. Run these commands to initialize the project correctly.

### A. Core Framework & UI Foundation
```bash
npm install next@latest react@latest react-dom@latest
npm install tailwindcss@latest @tailwindcss/postcss postcss
npm install clsx tailwind-merge lucide-react nuqs framer-motion
```

### B. Database & ORM (Drizzle + Neon)
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit tsx dotenv
```

### C. Authentication (Better Auth)
```bash
# Better auth core and organization plugin
npm install better-auth 
```

### D. Form State & Data Validation
```bash
npm install zod react-hook-form @hookform/resolvers
```

### E. Maps & Cartography (MapLibre)
```bash
# Ensure MapLibre GL is v5+ (or latest v4 if v5 is unstable in the current npm registry)
npm install maplibre-gl react-map-gl
```

### F. Forensics, AI & File Processing
```bash
# exifr for browser/server EXIF extraction
# sharp for 64-bit dHash perceptual hashing
# generative-ai for Gemini 3.x Flash evaluations
npm install exifr sharp @google/generative-ai
npm install @aws-sdk/client-s3 # For immutable object storage (R2/Cloudinary S3 API)
```

### G. Web3 & Cryptographic Anchoring
```bash
npm install viem
```

### H. Testing & Dev Tools
```bash
npm install -D vitest @vitest/ui
npm install -D eslint typescript @types/node @types/react @types/react-dom
npm install -D k6 # Load testing for pgvector/PostGIS scaling
```

---

## 2. Shadcn UI Initialization
Agents must initialize `shadcn/ui` components locally. We do not use bloated component libraries.

```bash
npx shadcn@latest init
# Install required atomic components
npx shadcn@latest add button card badge table tabs dialog dropdown-menu input textarea select separator skeleton sonner sheet tooltip
```


```

3. Recommended MCP Servers (Model Context Protocol)

To prevent the AI from hallucinating outdated boilerplate and to grant it direct access to your architecture, configure your IDE/Agent with these MCP servers:

@modelcontextprotocol/server-postgres: Grants read-only query access to the local Postgres/Docker instance. (Allows the AI to verify pgvector and PostGIS migrations work before writing Next.js API logic).

@neondatabase/mcp-server: Connects to Neon to automatically spin up database branches for isolated feature testing.

@modelcontextprotocol/server-brave-search: Critical for letting the agent search the live web for the latest Drizzle PostGIS syntax and Next.js 16 documentation.
```
4. Required Agent Skills (Context Injection)

Add these specific architectural instructions to your agent's custom skills, custom instructions, or memory constraints:

Backend Skill (Drizzle Spatial/Vector Ops): "When writing Drizzle ORM schemas for Delta, use customType for PostGIS geometry and pgvector bit columns. For distance queries, you must use raw sql\`fragments forST_Contains, ST_DWithin, and <->` (Hamming distance). Never pull full datasets into Node.js to calculate distances in memory."

Backend Skill (Service Layer Pattern): "Server Actions in Next.js 16 are purely UI adapters. You must place all core business logic (forensics, anchoring, DB writes) inside src/server/services/. Server actions only validate Zod payloads, call the service layer, and return a { data, error } object."

Frontend Skill (MapLibre + Shadcn Integration): "When designing the Impact Atlas, ensure react-map-gl is the base layer. All floating UI panels, filter pills, and telemetry drawers must use shadcn/ui components structured with Tailwind absolute positioning layered over the map canvas. Always use [longitude, latitude] array ordering for MapLibre GeoJSON compliance."

Frontend Skill (Living Earth Design Tokens): "Enforce the Delta color palette strictly. Use #101A18 for dark mode backgrounds, #172623 for elevated cards, and #D7F6B8 for primary buttons and active verification states. Use Geist_Mono with tabular-nums for all rendered coordinates, risk scores, and cryptographic hashes."