# Agent Prompt Sequence

Copy-paste prompts for Claude Code, in order. One stage per prompt.

**Rules for you, the maintainer:**

- Never paste the next prompt until you have read the output of the current one.
- Every prompt ends with STOP. If the agent keeps going, start a fresh session
  and paste the prompt again — do not argue with a session that has ignored a
  leash once.
- After each stage, run `pnpm check` yourself. Do not take the agent's word.
- Commit at the end of every stage. Small commits are how you roll back.

---

## Stage 0 — Repo reset

**You do this first, by hand. Do not give it to the agent.**

```bash
cd /path/to/delta-mrv
git checkout main && git pull
git checkout -b rebuild/foundation

# Move the spec to the repo root where Claude Code reads it
git rm -f AGENTS.md
git mv delta-mrv-scope/CLAUDE.md  CLAUDE.md
git mv delta-mrv-scope/AGENTS.md  AGENTS.md
git mv delta-mrv-scope/docs       docs
git mv delta-mrv-scope/INSTALL.md docs/INSTALL.md
rmdir delta-mrv-scope

# Hooks
chmod +x .githooks/*
git config core.hooksPath .githooks
git config user.name  "Shoumik Orgho"
git config user.email "orghodutta@gmail.com"

git add -A
git commit -m "docs(scope): move architecture contract to repository root"
```

Before deleting the old AGENTS.md, skim it. If it contains anything not
covered by the `docs/` set, paste that into the right numbered file first.

---

### Prompt 0 — Salvage and strip

> Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/02-ARCHITECTURE.md` completely. They override your training data.
>
> This repository contains an earlier implementation built against a stack the contract forbids. Your job in this stage is to salvage four functions and delete the rest. Write no new code.
>
> **Salvage.** Copy these into `docs/salvage/` as plain reference files, unchanged, with a one-line header saying which file they came from:
> - `computeSha256` and `computeDHash` from `src/server/services/forensics.service.ts`
> - `extractExifTelemetry` from the same file
> - the `geometryPoint` custom type, including the EWKB hex parser, from `src/server/db/schema.ts`
>
> `docs/salvage/` is reference material only. Nothing imports from it.
>
> **Delete.** Remove: `app/`, `components/`, `lib/`, `src/lib/`, `src/server/`, `drizzle/`, `scripts/`, `public/uploads/`, `neon.ts`, `components.json`, `drizzle.config.ts`, `package-lock.json`, and `node_modules/`.
>
> Keep: `CLAUDE.md`, `AGENTS.md`, `docs/`, `.githooks/`, `.agents/`, `README.md`, `.gitignore`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`.
>
> **Report.** List what you salvaged and what you deleted. Make no commit. STOP.

Then you commit:

```bash
git add -A
git commit -m "chore: strip pre-contract implementation, preserve salvaged algorithms"
```

---

## Stage 1a — Registry pre-flight

**Nothing is installed in this stage. This is the cheapest checkpoint in the
whole build and it catches the most expensive mistakes.**

> Read `docs/07-DEPENDENCIES.md` completely. It overrides your training data about versions and APIs.
>
> Run `pnpm view <pkg> version dist-tags deprecated time.modified` for every package in the approved table in §3. Paste the raw output for each one.
>
> Then produce a table with one row per package: package name, the version you propose to pin, whether `latest` satisfies the constraint in §3, and whether it is deprecated.
>
> Install nothing. Create no files. Modify no files. Do not scaffold. STOP.

### What you check yourself

| Check | If it fails |
|---|---|
| `drizzle-orm` latest is 0.x | If 1.x, pin the newest 0.x explicitly. The 1.x `defineRelations()` API breaks every schema example in the docs. |
| `next` is 16.x | If 17 has shipped, stop and reassess. `proxy.ts`, `after()` and async `params` are Next 16 assumptions. |
| `@google/genai` resolves | And `@google/generative-ai` appears nowhere. |
| `postgres` is listed | And `@neondatabase/serverless` is not. If the agent proposes the Neon driver, it skipped `docs/03-DATABASE.md` §1.1 — restart the session. |
| Nothing says `deprecated` | Any deprecation is a stop-and-ask. |

Approve explicitly before moving on.

---

## Stage 1b — Toolchain and guards

> Install exactly the versions I approved, using `pnpm add -E`. Log every one in `docs/DEPENDENCY_LOG.md` with the date and the reason.
>
> Then set up, and nothing more:
> - `.nvmrc` and `package.json#engines` for the Node version
> - `pnpm-workspace.yaml` with `minimumReleaseAge: 10080` and `allowBuilds: { sharp: true }`
> - `scripts/check-forbidden-deps.mjs` enforcing the forbidden package and file lists in `docs/07-DEPENDENCIES.md` §4, plus the assertion that `ANCHOR_PRIVATE_KEY` appears in at most one source file
> - `eslint.config.mjs` with the `no-restricted-imports` layer boundaries from `docs/02-ARCHITECTURE.md` §3
> - `src/env.ts` validating every variable in `docs/07-DEPENDENCIES.md` §5 with Zod, failing loudly on a missing one. No placeholder fallbacks.
> - `.env.example` listing every variable with an empty value
> - the `pnpm check` script
> - `vitest.config.ts` with the `server-only` stub aliased to `test/stubs/empty.ts`
>
> Do not create database code, auth code, routes, or components.
>
> Run `pnpm check` and paste the output. STOP.

Verify: `pnpm check` is green, and `node scripts/check-forbidden-deps.mjs`
actually fails when you temporarily add `axios` to `package.json`. Test the
guard before you trust it.

```bash
git commit -m "build: pin toolchain, add dependency guard and layer boundaries"
```

---

## Stage 1c — Database schema

> Read `docs/03-DATABASE.md` completely.
>
> Build:
> - `docker-compose.yml` and `docker/db.Dockerfile` — PostGIS 17 and pgvector in one container
> - `src/server/db/client.ts` — postgres.js over TCP, pooled URL, `prepare: false`, small pool. Not the Neon HTTP driver.
> - `src/server/db/schema/` — every table in §4, with the custom `geography` and `bit64` column types. Port the EWKB parser from `docs/salvage/`.
> - `drizzle.config.ts` pointing at the unpooled URL
> - A hand-written migration enabling the `postgis` and `vector` extensions, which must run first
> - A hand-written migration with the append-only triggers and revoked grants from §5
> - A hand-written migration with every index in §6, including the HNSW `bit_hamming_ops` indexes
>
> Generate the migrations. Apply them to the local Docker database only — not to the hosted database.
>
> Paste the full generated SQL. STOP.

**Read that SQL yourself.** This is the stage where a wrong column type costs
you three days later. Specifically check: `geography` not `geometry`;
`risk_score`, `risk_band` and `scoring_version` exist only on
`evidence_submission`; `audit_event` has a unique `(org_id, seq)`;
the HNSW indexes exist.

```bash
git commit -m "feat(db): add schema, extensions, append-only enforcement and indexes"
```

---

## Stage 1d — The spike

> Read `docs/11-IMPLEMENTATION.md` §Stage 1.
>
> Write and run exactly three integration tests against the local Docker database:
> 1. Insert a `geography(Polygon,4326)`, then query `ST_Covers` and `ST_DWithin` through a Drizzle `sql` fragment and assert correct results for a point inside, a point just outside, and a point far outside.
> 2. Insert several `bit(64)` values, then query for Hamming distance below 8 through Drizzle and assert the right rows come back.
> 3. Attempt a direct `UPDATE` on `audit_event` and assert that it raises.
>
> Write no other code. Paste the test output. STOP.

**If any of these fight you, stop the whole build and tell me.** Finding out
now that the spatial or vector layer does not work through the ORM is cheap.
Finding out at Stage 6 is not.

```bash
git commit -m "test(db): add PostGIS, Hamming and immutability spike tests"
```

---

## Stage 1e — Auth

> Read `docs/04-AUTH.md` completely.
>
> Configure Better Auth with the `organization` plugin and the Drizzle adapter. Generate the auth schema with the CLI `generate` command only — never `migrate`. Add the `org_type`, `country` and `website` columns to `organization` in a follow-up Drizzle migration.
>
> Build `src/server/auth/` with the session helpers and `src/proxy.ts` for the optimistic redirect. Do not create `middleware.ts`.
>
> Build no UI. Build no review logic yet.
>
> Run `pnpm check` and paste the output. STOP.

```bash
git commit -m "feat(auth): configure Better Auth with organization types"
```

---

## Stage 2 — Tenancy, the COI rule, state machine, seed

**This is the gate that decides whether you have a product.**

> Read `docs/04-AUTH.md` §4 and §5, and `docs/01-FEATURE-LOCK.md` §State machine.
>
> Build, in this order, tests before implementation:
> 1. `src/lib/state-machine/` — the full transition table with unit tests covering every legal and illegal transition
> 2. `src/server/services/projects.service.ts` — CRUD, PostGIS polygon queries, coordinate fuzzing, the salted location commitment
> 3. `assertCanReview` in `src/server/services/reviews.service.ts`
> 4. `test/integration/coi.test.ts` — every case in the table in `docs/04-AUTH.md` §4
> 5. `test/integration/tenancy.test.ts` — for every service read function, a caller from an unrelated organisation gets nothing, and cross-tenant requests return 404 not 403
> 6. `scripts/seed.ts` — three demo organisations, four Bangladesh projects with real polygons, three verifier users, and 5,000+ historical submission rows reusing a small image pool
>
> Build no UI in this stage.
>
> Paste the full test output. STOP.

Do not approve Stage 3 until every COI and tenancy test is green. If an owner
can review their own organisation's work, nothing built after this matters.

```bash
git commit -m "feat(services): enforce tenancy isolation and conflict-of-interest rule"
```

---

## Stage 3 — Atlas and the public read path

> Read `docs/05-ROUTES.md` and `docs/06-DESIGN-SYSTEM.md` completely.
>
> Build:
> - `src/server/storage/` — the `StoragePort` interface and the private blob adapter
> - `/atlas` with MapLibre GL JS v5, PostGIS polygons, status filter pills, project drawer
> - `/projects/[id]` public view
> - Read-only `/api/v1/projects` and `/api/v1/projects/[id]`
> - `test/integration/fuzzing-leak.test.ts` — an unauthenticated request to every public endpoint never returns `exactGeoJson` or `location_salt`
>
> Apply the Field and Paper themes exactly as specified in §2 of the design system. Read §5 and obey every prohibition in it.
>
> Paste the leak test output. STOP.

```bash
git commit -m "feat(atlas): add impact atlas, public project views and coordinate fuzzing"
```

---

## Stage 4 — Intake, queue, forensics

> Read `docs/10-FORENSICS.md` completely and port the salvaged algorithms from `docs/salvage/`.
>
> Build:
> - `/projects/[id]/submit` with client-side SHA-256 at selection time and the IndexedDB offline queue
> - `src/server/services/jobs.service.ts` — `FOR UPDATE SKIP LOCKED`, attempts, exponential backoff, idempotency keys, `after()` trigger, `/api/internal/jobs/drain`, admin retry
> - `src/server/services/forensics.service.ts` — every deterministic stage in §2, each producing a `forensic_finding` row with the exact severity from the table in §3
> - `src/lib/scoring/v1.ts` — a pure versioned function over findings
> - `test/integration/forensics-disclosure.test.ts` — no cross-organisation identifier appears in any payload reachable by an unprivileged caller
> - the eval fixture set, committed
>
> `risk_score`, `risk_band` and `scoring_version` on `evidence_submission` are a cache, written only by `src/lib/scoring/v1.ts`. Store the scoring version with them, never render the score without its findings beside it, and never let it gate a transition (`docs/10-FORENSICS.md` §6).
>
> Paste the disclosure test output. STOP.

Verify by hand: submit a seeded duplicate and watch a `HIGH` finding appear.
Kill the worker mid-job and confirm the row becomes claimable again.

```bash
git commit -m "feat(forensics): add intake, job queue and finding-based forensic pipeline"
```

---

## Stage 5 — Evidence Lab and the audit chain

> Read `docs/02-ARCHITECTURE.md` §4.5 and `docs/06-DESIGN-SYSTEM.md` §7.
>
> Build:
> - `src/server/services/audit-chain.service.ts` with `pg_advisory_xact_lock` and RFC 8785 canonical JSON
> - `scripts/verify-audit-chain.ts`
> - a test proving a tampered row breaks verification at that exact sequence number
> - `/lab` — keyboard-driven queue, severity-sorted, assignment-scoped
> - `FindingCard` with the full drill-down to the literal inputs
> - `EvidencePair` with a comparison slider and synced zoom
> - `reviews.service.ts` with 2-of-N quorum and mandatory written reasons
> - `ai-audit.service.ts` per `docs/08-AI.md`, as a job, advisory only
>
> Paste the chain verification output over the full seeded dataset. STOP.

```bash
git commit -m "feat(lab): add reviewer workspace, quorum and hash-chained audit log"
```

---

## Stage 6 — Contract and anchoring

> Read `docs/09-WEB3.md` completely.
>
> Build `contracts/` as a Foundry project with `ImpactAnchorRegistry.sol` and the complete test matrix in §3, including the fuzz tests.
>
> Run `forge test -vvv` and paste the output. Do not deploy. STOP.

Review the Solidity yourself. Then approve deployment separately:

> Deploy to Base Sepolia, verify the source on BaseScan, and paste the address and the BaseScan link. Then build `anchor.service.ts`, the daily cron endpoint and the admin "Anchor now" button. STOP.

```bash
git commit -m "feat(anchor): add registry contract and Base Sepolia Merkle anchoring"
```

---

## Stage 7 — Proof dossier and public API

> Read `docs/05-ROUTES.md` §4 and `docs/09-WEB3.md` §7.
>
> Build `/proof/[id]` in the Paper theme with all eight sections in order, browser-side manifest recomputation, Merkle verification via viem, the drop-original-photo verifier, the salted commitment display, and the print stylesheet.
>
> Then `/api/v1/submissions/[id]/proof`, API key auth, and the funder view.
>
> Add a Playwright test asserting the manifest hash is byte-identical in Node and in a real browser.
>
> Paste the test output. STOP.

Verify by hand: open the proof page in a private window with no session, drop
the original photo, see green. Then point `BASE_SEPOLIA_RPC_URL` at a dead
host and confirm you get `UNAVAILABLE` — not `MISMATCH`.

```bash
git commit -m "feat(proof): add public proof dossier with client-side verification"
```

---

## Stage 8 — Evidence, polish, ship

> Read `docs/11-IMPLEMENTATION.md` §Stage 8.
>
> Build `scripts/eval-forensics.ts` and `scripts/replay-forensics.ts`. Run the eval harness and write real precision and recall numbers into `docs/FORENSIC_EVAL.md`, including the known misses.
>
> Run k6 against the local Docker database with the 5,000 seeded rows, measuring p95 for the Hamming and spatial queries. Record the numbers in `README.md`.
>
> Add the demo role switcher and the tamper demo, both gated on `DEMO_MODE`.
>
> Write `test/e2e/demo-path.spec.ts` covering the full six-step demo.
>
> Do the accessibility pass: contrast on both themes, full keyboard operation, 320px width, 200% zoom.
>
> Write `README.md` from `docs/00-PRODUCT.md`, including the "what this does not prove" section verbatim and a summary of the threat model.
>
> Paste the eval table, the k6 numbers and the Playwright output. STOP.

```bash
git commit -m "docs: add forensic evaluation, load test results and project README"
```

Then merge to `main` and deploy.

---

## If the agent goes off the rails

Signs to watch for:

| Sign | What it means |
|---|---|
| Proposes `@neondatabase/serverless` | Skipped `docs/03-DATABASE.md`. Restart the session. |
| Writes `risk_score` from anywhere but `src/lib/scoring/`, renders it without its findings, or lets it gate a transition | Skipped the four conditions in `docs/10-FORENSICS.md` §6. Restart. |
| Builds UI before the service passes tests | Broke the Stage ordering law. Revert and re-prompt. |
| Adds an admin override on review | Broke M2. Revert immediately, this is the product. |
| Says "done" without pasting test output | Do not believe it. Ask for the output. |
| Touches `src/lib/crypto/` | Revert. Propose-only. |
| Uses `--no-verify` on a commit | Scope violation. Revert and re-prompt. |

Restarting a session is cheaper than correcting one that has already ignored
the contract once. Context rot is real; a fresh session re-reads the docs.
