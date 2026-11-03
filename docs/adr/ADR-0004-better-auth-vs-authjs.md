# ADR-0004 — Better Auth, not Auth.js

**Status:** Accepted
**Date:** 2026-11-01
**Deciders:** Shoumik Orgho

## Context

Delta needs sessions plus first-class multi-tenancy: organisations,
memberships, invitations, roles, and an active-organisation concept — all
stored in the same Postgres database as the domain tables so tenancy checks
can join.

## Decision

`better-auth` 1.x with the `organization` plugin and the Drizzle adapter.

## Reasoning

- The organization plugin provides organisations, members and invitations as
  real tables in our database, which the service layer can join against in the
  same transaction as a tenancy check.
- Auth.js is oriented around OAuth providers and sessions; organisation
  modelling would be hand-rolled on top.
- Schema is generated into our Drizzle schema, so Drizzle Kit owns migrations
  and there is one migration path, not two.

## Consequences

- Run the Better Auth CLI with `generate` only. Never `migrate` — two
  migration owners would diverge.
- `nextCookies()` must be the last plugin.
- **`session.activeOrganizationId` is UI context, not an authorisation claim.**
  Every service call independently re-verifies membership against the database.
  This is written into `docs/04-AUTH.md` because getting it wrong would make
  the tenancy model decorative.

## Alternatives rejected

**Auth.js / NextAuth** — organisation modelling would be bespoke anyway.
**A hosted identity provider** — external dependency, a cost ceiling, and
tenancy data living outside the database we need to join against.
