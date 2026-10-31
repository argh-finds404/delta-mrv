---
name: service-layer-pattern
description: >-
  Backend skill enforcing the Service Layer Pattern for Next.js 16 Server Actions and core business logic in Delta-MRV. Use whenever writing Server Actions, API handlers, forensics pipelines, cryptographic anchoring, or database mutations.
---

# Backend Skill: Service Layer Pattern

Server Actions in Next.js 16 are purely UI adapters.

## Rules & Constraints

1. **Service Layer Location**: Place all core business logic (forensics, cryptographic anchoring, database writes) inside `src/server/services/` (or `server/services/`).
2. **Thin Server Actions**: Server Actions must **only**:
   - Validate incoming payloads with Zod schemas
   - Call the appropriate function in the service layer (`src/server/services/`)
   - Return a standardized `{ data, error }` object
3. **No Direct DB/Forensics Logic in UI Adapters**: Never embed raw Drizzle mutations, EXIF/dHash processing, or Web3 anchoring directly inside a Server Action or React component.

