# ADR-0003 — Drizzle ORM and postgres.js, not Prisma, not an HTTP driver

**Status:** Accepted
**Date:** 2026-11-01
**Deciders:** Shoumik Orgho

## Context

Delta needs PostGIS geography columns, pgvector `bit(64)` with
`bit_hamming_ops`, `SELECT … FOR UPDATE SKIP LOCKED`, and
`pg_advisory_xact_lock` inside transactions.

## Decision

`drizzle-orm` (stable 0.x) over `postgres.js` on TCP.

## Reasoning

- Drizzle's `sql` fragments let PostGIS and pgvector operators be used
  directly, with custom column types for `geography` and `bit(64)`. Prisma's
  support for both requires raw escape hatches that lose type safety anyway.
- Migrations are plain SQL files that can be read and reviewed. Extensions,
  triggers, grants and HNSW indexes live alongside the generated ones.
- **The driver choice is forced, not preferred.** The Neon HTTP driver
  (`drizzle-orm/neon-http`) throws `No transactions support in neon-http
  driver` — transactions require a stateful connection that HTTP cannot
  provide. Delta's advisory-locked audit chain, its `SKIP LOCKED` job queue
  and its atomic state transitions are all impossible on it. postgres.js over
  TCP is the only option that works.

## Consequences

- Pool size must stay small to respect the hosted free tier's compute budget.
- `prepare: false` at runtime; migrations use the unpooled URL.
- Relations use the 0.x `relations()` API. Drizzle 1.x's `defineRelations()`
  is a different API and is on the forbidden list until deliberately adopted.

## Alternatives rejected

**Prisma** — weak PostGIS and pgvector story; a heavier client for a project
whose hardest queries are spatial and vector.
**Raw SQL only** — no type safety across a schema this size.
**neon-http** — cannot run a transaction. Disqualifying.
