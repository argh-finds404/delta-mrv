# Delta-MRV: High-Integrity Autonomous Ecological Verification

**Delta-MRV** is an autonomous, tamper-proof Measurement, Reporting & Verification (MRV) platform designed to eliminate fraud in carbon offset and ecological restoration projects (e.g., mangrove restoration in the Sundarbans).

Instead of relying on slow, corruptible manual paper audits, Delta-MRV cross-references:
1. **Physical Grounding**: Native PostGIS geofencing ensuring photos originated inside real project boundary polygons.
2. **Perceptual Duplicate Prevention**: 64-bit dHash visual fingerprinting and pgvector Hamming distance (`<~>`) to prevent photo recycling.
3. **Multimodal AI Forensics**: Google Gemini 2.5 Flash evaluating canopy health, vegetation density, and detecting screen recaptures or spoofing.
4. **Multi-Tenant Trust**: Better Auth with organization workspaces for Project Developers, Field Verifiers, and Auditors.
5. **Zero-Cost Mandate**: Built entirely on free-tier, open-source infrastructure ($0/month operating cost).

---

## Architecture Overview

```
Frontend (Next.js 16 + React 19 + Shadcn UI + Tailwind v4)
  │
  ▼
Server Actions (UI Adapters in app/actions/)
  │
  ▼
Core Service Layer (src/server/services/)
  ├── Forensics Service (SHA-256, 64-bit dHash via Sharp, EXIF via Exifr, Gemini 2.5 Flash)
  ├── Storage Service (Local zero-cost storage under public/uploads/)
  └── Database Service (Telemetry, PostGIS & pgvector ops)
  │
  ▼
Database Layer (Drizzle ORM + Neon Lakebase Postgres)
  ├── PostGIS (v3.6.4): geometry(Point, 4326) coordinates & spatial boundaries
  ├── pgvector (v0.8.6): bit(64) columns with native Hamming distance (<~>)
  └── Better Auth: Multi-tenant user, session, and organization schemas
```

---

## Getting Started

### 1. Prerequisites
- Node.js 20+ / 22+
- A free [Neon](https://neon.tech) account (Postgres)
- A free [Google AI Studio](https://aistudio.google.com/) API key (for Gemini 2.5 Flash)

### 2. Environment Setup
Create a `.env.local` file in the project root:
```env
DATABASE_URL="postgresql://user:pass@ep-name-pooler.region.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-name.region.neon.tech/neondb?sslmode=require"
NEON_BRANCH="production"

BETTER_AUTH_SECRET="your-32-char-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Run Migrations & Start Development
```bash
# Apply PostGIS & Better Auth migrations to Neon
npm run db:migrate

# Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the live verification studio and database telemetry.

---

## Agent Guidelines & Standards
For AI coding assistants (Cursor, Claude, Antigravity, Copilot), refer to [AGENTS.md](./AGENTS.md) for strict architectural rules, Drizzle spatial typings, and the Service Layer pattern.
