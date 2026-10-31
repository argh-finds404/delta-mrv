---
name: drizzle-spatial-vector-ops
description: >-
  Backend skill for writing Drizzle ORM schemas and spatial/vector queries in Delta-MRV using PostGIS geometry and pgvector bit columns. Use whenever defining database schemas, perceptual hash columns, geospatial boundaries, or running spatial/Hamming distance queries.
---

# Backend Skill: Drizzle Spatial & Vector Operations

When writing Drizzle ORM schemas for Delta, use `customType` for PostGIS `geometry` and `pgvector` `bit` columns.

## Rules & Constraints

1. **Custom Types**: Always define PostGIS `geometry` and `pgvector` `bit(64)` (64-bit dHash perceptual hash) columns using `customType` from `drizzle-orm/pg-core`.
2. **Database-Level Distance Queries**: For spatial and vector distance queries, you **must** use raw `sql` fragments for:
   - `ST_Contains`
   - `ST_DWithin`
   - `<~>` (Hamming distance operator on `bit` columns; note that `<->` is for Euclidean L2 distance on vector types)
3. **Zero In-Memory Distance Calculation**: **Never** pull full datasets into Node.js to calculate spatial or perceptual hash distances in memory.

