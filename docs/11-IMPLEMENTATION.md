# 11 — Implementation Order and Testing

Authority over: build sequence, definition of done, testing strategy.

---

## 1. The ordering law

> **No UI for a capability whose service layer does not exist and pass tests.**

The characteristic failure of an AI-assisted build is a beautiful application
where nothing underneath is real. Service first, test second, interface third.
Every stage.

A second law: **write the test before the implementation** for anything
touching the hash chain, the conflict-of-interest rule, the state machine, or
the manifest. These are the parts where a bug is invisible until it matters.

## 2. Stages

Each stage has an exit gate. Do not begin the next stage until the gate is
green. "Day" is a unit of work, not a promise about the calendar.

### Stage 1 — Foundation and the spike

- `pnpm 11`, `.nvmrc`, engines, workspace quarantine
- `scripts/check-forbidden-deps.mjs` and ESLint layer boundaries, wired into
  `pnpm check`
- `docker-compose.yml` with the PostGIS + pgvector image
- Extension migration
- **The spike, before anything else is built.** Three Vitest integration tests
  (`test/integration/spike.test.ts`, run with `pnpm test:integration`):
  1. Insert a `geography(Polygon,4326)`, query `ST_Covers` and
     `ST_DWithin` through a Drizzle `sql` fragment
  2. Insert a `bit(64)`, query Hamming distance below 8 through Drizzle
  3. A direct `UPDATE` on an append-only table raises (`audit_event`,
     `review_decision` and `anchor_leaf`, each also for `DELETE` and `TRUNCATE`)
- Full Drizzle schema, append-only triggers and grants, every index from
  `docs/03-DATABASE.md`
- Better Auth with the organization plugin and `org_type`
- `src/env.ts`
- `docs/THREAT_MODEL.md`, ADR-0001 … 0005

**Gate:** both spike tests pass. A direct `UPDATE` on `audit_event` raises.
`pnpm check` green.

**Spike status: PASSED 2026-11-02** — 18 of 18 tests, against a Neon dev branch
(`dev-spike`, PostgreSQL 18.6, PostGIS 3.6.4, pgvector 0.8.6) with all five
migrations applied. Also run against the local Docker image on 2026-11-03: 74 of
74 integration tests, all five migrations applied. Result that changed the spec: `ST_Contains`
has no `geography` form, so the geofence check is `ST_Covers`.

If the spike fights you, stop and report. Finding out on Stage 1 that the
geospatial or vector layer does not work through the ORM is cheap. Finding
out on Stage 5 is not.

### Stage 2 — Tenancy, state machine, seed

- `src/lib/state-machine/` with the full transition table and unit tests
- `projects.service.ts` with coordinate fuzzing and the location commitment
- `assertCanReview` and the complete conflict-of-interest suite
- Tenant isolation suite
- `scripts/seed.ts`: three demo organisations, four Bangladesh projects with
  real polygons, 5,000+ historical submission rows reusing a small image pool

**Gate:** `test/integration/coi.test.ts` and `tenancy.test.ts` fully green.
No reviewer UI exists yet. If an owner can review their own org's work, the
product does not exist.

**Stage 2 status: GATE GREEN 2026-11-03** — `coi.test.ts` 27/27 and
`tenancy.test.ts` 22/22 against the Neon dev branch; `pnpm check` green. Run
against local Docker on 2026-11-03 as well (the full suite, 74/74). Known gaps: decisions append no audit event until
`audit-chain.service` exists (Stage 5); there is no representation of a
"platform admin" in the schema, so that test proves only that a user with no
organisation has no path to a vote.

### Stage 3 — Atlas and public read path

- `StoragePort` interface and blob adapter
- `/atlas` with MapLibre, polygons, status filters, project drawer
- `/projects/[id]` public view
- Read-only `/api/v1`
- Fuzzing leak test: an unauthenticated request to every public endpoint and
  tile never contains `exactGeoJson` or `location_salt`

**Gate:** leak test green. Atlas renders seeded polygons.

### Stage 4 — Intake, queue, forensics

- `/projects/[id]/submit` with client-side hashing and the IndexedDB offline
  queue
- `jobs.service.ts`: `FOR UPDATE SKIP LOCKED`, attempts, backoff, idempotency,
  `after()` trigger, drain endpoint, admin retry
- `forensics.service.ts`: all deterministic stages from `docs/10-FORENSICS.md`
- `src/lib/scoring/v1.ts`
- Cross-tenant disclosure test
- Eval fixtures committed

**Gate:** submit a seeded duplicate and watch a `HIGH` finding appear.
Disclosure test green. Killing the worker mid-job leaves the row claimable.

### Stage 5 — Evidence Lab

- `audit-chain.service.ts` with the advisory lock, plus a test proving a
  tampered row breaks verification at that exact sequence number
- `/lab` queue: keyboard-driven, severity-sorted, assignment-scoped
- `FindingCard` with the full drill-down
- `EvidencePair` comparison
- `reviews.service.ts`, 2-of-N quorum, mandatory reasons
- AI advisory job

**Gate:** two distinct verifier users approve a submission and it reaches
`APPROVED`. Chain verification script passes over the whole seeded dataset.

### Stage 6 — Contract and anchoring

- Foundry project, `ImpactAnchorRegistry.sol`, full test matrix from
  `docs/09-WEB3.md`
- Deploy to Base Sepolia, verify on BaseScan
- `anchor.service.ts`: manifest build, Merkle tree, batch rows, viem send,
  receipt polling
- Daily cron, admin "Anchor now", pending badges

**Gate:** `forge test -vvv` green. A real batch confirmed on chain with a
BaseScan link.

### Stage 7 — Proof dossier and public API

- `/proof/[id]` in Paper theme
- Browser-side manifest recomputation and Merkle verification via viem
- Drop-original-photo verifier
- Salted commitment display, exact polygon unlock for authorised sessions
- Print stylesheet
- `/api/v1/submissions/[id]/proof`, API keys, funder view

**Gate:** open the proof page in a private window with no session, drop the
original photo, see green. Kill the RPC and confirm `UNAVAILABLE`, not
`MISMATCH`.

### Stage 8 — Evidence, polish, ship

- `scripts/eval-forensics.ts` → `docs/FORENSIC_EVAL.md` with real numbers
- `k6` against local Docker Postgres, p95 for Hamming and spatial queries →
  README
- `scripts/replay-forensics.ts`
- Demo role switcher, tamper demo
- Playwright E2E covering the full 60-second demo
- Accessibility pass: contrast, keyboard, 320 px, 200 % zoom
- README with the threat model and the "what this does not prove" section
- Deploy

**Gate:** a stranger with only the URL completes the demo path unaided.

## 3. The 60-second demo

This is the acceptance test for the whole product. It must work end to end at
every stage after Stage 7.

1. Sign in as the field submitter, submit before/after evidence
2. Findings appear, including a flagged duplicate
3. Switch to verifier one, review, approve
4. Switch to verifier two, approve — status becomes `APPROVED`
5. Click "Anchor now"
6. Open the public proof page, drop in the original photo, watch it verify
   green against the chain

Playwright runs this as `test/e2e/demo-path.spec.ts`.

## 4. Testing strategy

| Layer | Tool | Covers |
|---|---|---|
| Pure logic | Vitest unit | State machine, scoring, canonicalisation, dHash packing, severity mapping |
| Services + DB | Vitest integration against Docker Postgres | COI, tenancy, append-only, queue concurrency, PostGIS, Hamming, chain verification |
| Contract | Foundry | Access control, duplicate batches, ownership, proofs, fuzz |
| End to end | Playwright | Demo path, proof verification, keyboard review |
| Empirical | Eval harness, k6 | Precision/recall, p95 latency |

**Integration test isolation.** Each integration test runs inside a transaction
and rolls back; none truncates a table. `review_decision`, `audit_event` and
`anchor_leaf` cannot be truncated by design (revoked grant plus a
`BEFORE TRUNCATE` trigger, `drizzle/0003_append_only.sql`), so rollback is the
only cleanup that works for them and it is used everywhere for consistency.

**Integration tests scope every read to rows they created themselves**, by id or
by a test-specific key prefix (for example `storage_key like 'spike/%'`). The
database is shared with seeded data, and that data changes. A test that reads
the first row of an unfiltered table passes by accident and fails the day the
seed changes. Two spike tests did exactly that and broke on 2026-11-03: one read
the first row of `project_private_location`, which had been empty and then held
the four seeded polygons; the other scanned every row of `evidence_file` and
only passed because the 10,400 seeded hashes happened to be far from its
pattern. Both now select by the id or prefix of what they inserted.

### Tests that must exist and never be weakened

1. Owner cannot review their own organisation's submission
2. Unassigned verifier cannot review
3. A 1 approve / 1 reject split moves the submission to `ESCALATED`; only a verifier-org admin who has not yet voted can resolve it, and a platform admin cannot
4. Cross-tenant read returns 404, not 403
5. `UPDATE` on `audit_event` raises
6. A tampered audit row breaks chain verification at its sequence number
7. Unauthenticated responses never contain exact geometry or the salt
8. Cross-org findings never disclose the matching organisation
9. Manifest hash is identical in Node and in the browser
10. A failed AI call leaves the submission intact and reviewable
11. Two workers claiming the queue concurrently never process the same job
12. Replay produces byte-identical deterministic findings

If one of these fails, fix the code. Never the test.

## 5. Definition of done

A unit of work is done when all of the following hold:

- [ ] `pnpm check` green — eslint, `tsc --noEmit`, vitest, forbidden-deps
- [ ] New integrity logic has a test written before the implementation
- [ ] No `as any`, `@ts-expect-error`, `.skip`, or `eslint-disable`
- [ ] No TODO left in a code path a user can reach
- [ ] Every new route is listed in `docs/05-ROUTES.md`
- [ ] Every new package is logged in `docs/DEPENDENCY_LOG.md`
- [ ] Any decision that changed is reflected in the relevant doc
- [ ] Commits are authored as the maintainer (`docs/12-AGENT-SCOPE.md` §4)

## 6. When blocked

Stop and report. Do not:

- Weaken a test to make it pass
- Install a forbidden package "temporarily"
- Mock a service layer to unblock a UI
- Scaffold a feature from the CUT list
- Invent a dependency version instead of checking the registry
- Change `src/lib/crypto/`

Report format: what you tried, what failed, the exact error, and the two or
three options you see with a recommendation.
