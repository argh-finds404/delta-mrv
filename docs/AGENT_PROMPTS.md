# Agent Prompt Sequence

Copy-paste prompts for Claude Code, in order. One step per prompt. Everything
between the `>` marks is the prompt; paste it as it stands.

**Rules for you, the maintainer:**

- Never paste the next prompt until you have read the output of the current one.
- Every prompt ends with STOP. If the agent keeps going, start a fresh session
  and paste the prompt again — do not argue with a session that has ignored a
  leash once.
- After each step, run `pnpm check` yourself, and `pnpm test:integration` when
  the step touched the database. Do not take the agent's word.
- **You commit.** No agent runs `git commit`. Each step lists the message; the
  author is you, with no trailer and no agent named (`docs/12-AGENT-SCOPE.md` §4).
  Before committing, read the report's `FILES WRITTEN`: a path outside the
  agent's lane means revert that file.
- **A fresh session per lane.** Run Lane A, approve, commit, then paste the Lane B
  prompt in a new session (and the reverse). Context rot is real and a lane
  change is a natural place to clear it.
- `.env.local` is yours alone. The agents never read, print or write it. When a
  stage needs a new variable, the stage's prerequisite line says so.

## How every prompt after Stage 2 is built

Each prompt opens with the same four things, so you never reconstruct them:

1. **A lane.** *You are Lane A* (trust engine: server, domain, crypto, contracts,
   migrations, API routes, scripts) or *Lane B* (presentation: components, pages,
   styles, e2e). The lane names the paths it may write; anything else goes under
   `CROSS-LANE REQUESTS`. Authority: `docs/17-AGENT-LANES.md`. Where a step
   needs one narrow exception it is stated in that prompt (for example, "you are
   authorised to edit `src/app/(auth)/**` for this step only").
2. **A read-first list.** The documents for that step, plus
   `docs/16-AMENDMENTS-v2.md` (it overrides the numbered documents; each prompt
   names the amendments it carries). Lane B always adds `docs/18-VISUAL-CORRECTION.md`
   and `docs/19-LAYOUT-SPEC.md` (18 overrides 06 §2; 19 sets geometry).
3. **The judgment clause.** *Where the spec is silent, use your judgment and say
   what you decided and why. Where following it would produce something that
   reads or behaves badly, make the call and say so.* This exists because the
   Lab's text column came out about 20 characters wide by following a spec
   literally. Lane B adds: measure a number in the browser before trusting it.
4. **The §8 report and a stop.** `LANE / STAGE / STATUS / DONE / FILES WRITTEN /
   CHECK OUTPUT / CROSS-LANE REQUESTS / BLOCKED ON / READY TO COMMIT`, with
   `pnpm check` pasted. Then STOP.

Stages with both lanes run **Lane A first** (publish the service and its types),
then Lane B against the real thing. The large stages, 4 and 5, are split into
lettered steps the way Stage 1 was, each ending in its own STOP and commit.

Every stage lists **its exit gate**, in a table called *What you check yourself*:
what to run or click, and what a failure means. Do not approve the next stage
until the table holds.

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

**Status: accepted 2026-11-03.** `coi.test.ts` 27/27 and `tenancy.test.ts`
passing against the Neon `dev-spike` branch. Carried forward, with the stage
that owns each, in the *Carry-overs* table near the end of this file.

```bash
git commit -m "feat(services): enforce tenancy isolation and conflict-of-interest rule"
```

---

## Stage 3 — Atlas and the public read path

**Prerequisite:** Stage 2 accepted. `BLOB_READ_WRITE_TOKEN` is in `.env.local`
(you add it; the agent never touches that file).

Three steps: 3a is Lane A (storage and the public data), 3b is Lane B (the
pages), 3c is Lane A again (turn the redirects on). Paste 3a, approve, commit,
then paste 3b in a **fresh session**.

### Stage 3a — Storage and the public read services (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/05-ROUTES.md` §1 and §6, `docs/13-FEATURE-SPEC.md` D5, `docs/14-PAGE-SPEC.md` page 3, `docs/04-AUTH.md` §5, `docs/THREAT_MODEL.md` T5, `docs/02-ARCHITECTURE.md` §3. `docs/16-AMENDMENTS-v2.md` overrides the numbered documents: this stage carries **A6** (split public and workspace project routes).
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Build, in this order, tests before implementation:
> 1. `src/server/storage/` — the `StoragePort` interface and the private blob adapter. `requireEnv("BLOB_READ_WRITE_TOKEN")` at the point of use. Nothing outside this folder imports `@vercel/blob`, with one exception: `scripts/upload-seed-images.ts`.
> 2. `scripts/upload-seed-images.ts` — regenerate the eight seed pool images with the same generator `scripts/seed.ts` uses, upload them under their `storage_key`, then assert each uploaded file's SHA-256 equals `evidence_file.sha256` in the database. The seed cannot be re-run (append-only tables), so this is how the seeded rows get real bytes. If a hash does not match, stop and report: it means the pool is not reproducible.
> 3. Public read services per A6 in `projects.service.ts`: `listPublicProjects` and `getPublicProject` return ACTIVE projects with fuzzed geometry and the commitment only. The workspace functions stay separate. Cursor pagination, a hard page-size cap.
> 4. `GET /api/v1/projects` and `GET /api/v1/projects/[id]` — public, read-only, calling only those services.
> 5. `GET /api/evidence/[fileId]` — streams a file from `StoragePort` after the same visibility rules as `getSubmission` (owner org, assigned verifier org, funder only when APPROVED or ANCHORED). 404 not 403. `Cache-Control: private, no-store`.
> 6. `test/integration/fuzzing-leak.test.ts` — call every public route handler with no session and assert the body never contains the boundary, `location_salt`, or any vertex coordinate of an exact polygon. Add the image route to `tenancy.test.ts`.
>
> Finish with the §8 report. Paste `pnpm check` and the full output of `pnpm test:integration`. STOP.

**What you check yourself**

| Check | How | If it fails |
|---|---|---|
| The leak test would catch a leak | Temporarily return `boundary` from `getPublicProject`; the test must go red. Revert. | The test asserts nothing. Do not approve. |
| Public responses carry no salt | `curl localhost:3000/api/v1/projects` and read it | Stop. This is the product's privacy promise. |
| Seeded images exist | Sign in as `verifier1@delta-demo.example`, open an `/api/evidence/<id>` URL for a seeded file | The upload script did not run, or hashes disagree. |
| An unrelated org gets 404 on an image | The tenancy suite covers it; also try by hand from the funder account on an `IN_REVIEW` file | Visibility rule diverged from `getSubmission`. |
| `FILES WRITTEN` is all Lane A | Read the list | Revert the stray file. |

```bash
git commit -m "feat(storage): add storage port, public project reads and evidence image route"
```

### Stage 3b — Atlas, public project page and dashboard (Lane B)

> **You are Lane B.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane B paths: components, `src/app/**/*.tsx`, styles, `src/lib/format/**`, `test/e2e/**`. Do not edit services, schema, migrations, `package.json` or `src/app/api/**`; request them under CROSS-LANE REQUESTS. Do not commit; I commit. You run the one dev server: check whether one is already running before starting another.
>
> Read first: `docs/06-DESIGN-SYSTEM.md`, `docs/18-VISUAL-CORRECTION.md` and `docs/19-LAYOUT-SPEC.md` (18 overrides 06 §2; 19 sets geometry), `docs/14-PAGE-SPEC.md` pages 2, 3 and 8 (atlas, project, dashboard), `docs/15-UI-STATES.md`, `docs/05-ROUTES.md` §1 and §3, `docs/16-AMENDMENTS-v2.md` (this stage carries **A6** and **A10**).
>
> Where the spec is silent, use judgment and say what you decided and why. Where a number in the spec produces something unreadable, measure it in the browser and make the call: the Lab's 20-character text column came from following a spec literally.
>
> Build, against the real services and `/api/v1`:
> - `/atlas` — MapLibre GL JS v5, polygons from `/api/v1/projects`, status filter pills, the project drawer. The server decides fuzzed or exact; the map renders what it is handed.
> - `/projects/[id]` — the public view (Paper theme). Exact geometry never appears here, signed in or not (A6).
> - `/dashboard` — role-aware home per `docs/05-ROUTES.md` §3: owner sees project and submission status, verifier sees review-queue depth with a link to `/lab`, funder sees verified outcomes. A caller with no organisation sees an empty state, not an error.
> - Not in this stage: `/projects/new` and `/projects/[id]/manage`. The service exists; the UI is not in `docs/11`'s Stage 3 list.
>
> Before you report: open every page in a real browser at 1280, 1440, 1920 and 390 wide, and read it. Check every empty, loading and error state in `docs/15-UI-STATES.md` this stage touches. Signed out, signed in as owner, verifier and funder: they must see different things on `/atlas`, and none of them may see exact geometry on `/projects/[id]`.
>
> Finish with the §8 report. Paste `pnpm check`. STOP.

**What you check yourself**

| Check | How | If it fails |
|---|---|---|
| Atlas renders the four seeded polygons | Open `/atlas` signed out | Check `/api/v1/projects` first; that is Lane A's. |
| Signed out sees cell-centre points, not polygons | Compare with the owner account | The server is not deciding; the map is. Revert. |
| `/projects/[id]` has no exact data | View source and the network tab, signed in as the owner | Stop. A6 broken. |
| Verified green is not used as text colour | Look for green text on dark | A10. Fill, border or large icon only. |
| One `--signal` per screen | Count lime elements | `docs/18` §3. |

```bash
git commit -m "feat(atlas): add impact atlas, public project page and role-aware dashboard"
```

### Stage 3c — Turn the redirects on (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`. You are authorised to edit `src/app/(auth)/**` for this step only.
>
> Read first: `docs/04-AUTH.md` §6, `docs/05-ROUTES.md` §2 and §3, `docs/14-PAGE-SPEC.md` page 11, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Read first: `docs/04-AUTH.md` §6, `docs/05-ROUTES.md` §2 and §3, `docs/14-PAGE-SPEC.md` page 11, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Read first: `docs/04-AUTH.md` §6, `docs/05-ROUTES.md` §2 and §3, `docs/14-PAGE-SPEC.md` page 11, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> `/dashboard` now exists. Change the post-auth destination from `/lab` to `/dashboard` in `/sign-in`, `/sign-up` and `/demo`, keeping `next=` (via `safeNext`) ahead of the default. Verify in a real browser as a verifier, an owner and a funder: each lands on `/dashboard` and sees the right content. Remove the three `shortcut:` comments. Leave the proxy matcher as it is (`/dashboard` is already in it).
>
> Finish with the §8 report. STOP.

**Exit gate for Stage 3 — what you check before approving Stage 4:** the leak
test is green and you have watched it fail on a deliberate leak; `/atlas`
renders the seeded polygons; all three roles land on a working `/dashboard`;
`pnpm check` is green; `pnpm test:integration` is green.

```bash
git commit -m "feat(auth): land on the dashboard after sign-in"
```

---

## Stage 4 — Intake, queue, forensics

**Prerequisite:** Stage 3 accepted. `CRON_SECRET` is in `.env.local`. Before
4c, confirm `sharp` can decode every format the intake allows (`jpeg`, `png`,
`webp`, `heic`); the prebuilt binary may not decode HEIC. If it cannot, that is
a stop-and-report, never a silent drop of the format.

This is the first large stage, so it is split the way Stage 1 was. Each step
ends with STOP and a commit. 4a to 4c and 4e are Lane A; 4d is Lane B.

### Stage 4a — The job queue (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/02-ARCHITECTURE.md` §3 and §4, `docs/03-DATABASE.md` (the `job` table), `docs/11-IMPLEMENTATION.md` §4 (the tests that must never be weakened: #11), `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would behave badly, make the call and say so.
>
> Build `src/server/services/jobs.service.ts`, tests first: `FOR UPDATE SKIP LOCKED` claiming, attempts and `max_attempts`, exponential backoff with a cap, idempotency keys (the unique index already exists), a stuck-job reclaim (a `RUNNING` row whose `locked_at` is older than a timeout becomes claimable), `after()` to trigger a drain after the response, `GET /api/internal/jobs/drain` guarded by `requireEnv("CRON_SECRET")` and a constant-time compare, and an admin retry.
>
> Tests that must exist: two workers claiming concurrently never process the same job (real concurrent connections, not sequential calls); a job whose worker dies mid-run is reclaimed after the timeout; a failing job backs off and stops at `max_attempts` as `FAILED`; the same idempotency key twice creates one job. Job handlers are registered by `kind`; build the registry and one trivial handler for the tests, nothing else.
>
> Finish with the §8 report. Paste `pnpm check` and the `pnpm test:integration` output. STOP.

**What you check yourself:** the concurrency test uses separate connections
(open it and look); kill the process mid-handler by hand and confirm the row is
claimable again; the drain route returns 401 without the secret.

```bash
git commit -m "feat(jobs): add database-backed job queue with safe claiming and recovery"
```

### Stage 4b — Intake service and storage path (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/01-FEATURE-LOCK.md` §State machine and §Draft and direct upload, `docs/14-PAGE-SPEC.md` page 6 (intake), `docs/05-ROUTES.md` §5, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Build `src/server/services/submissions.service.ts`, tests first:
> - `createDraft(actor, projectId)` → `DRAFT`. Owner and admin of the owning org only; anyone else gets a 404.
> - A route handler that issues a scoped client-upload token restricted to the allowed MIME types and 5 MB.
> - `finalize(actor, submissionId)` in **one transaction**: verify the expected files exist and are within limits, read the bytes back from storage and hash them server-side, write `evidence_file` rows with the server's SHA-256 (the client's goes in `client_sha256`; a mismatch is a `CLIENT_HASH_MISMATCH` finding, never trusted), `DRAFT → PENDING_FORENSICS` through `assertTransition`, insert the forensics job. MIME is sniffed from the bytes, not the filename. 5 MB cap enforced on the stored size.
> - `addSupplement(actor, submissionId, file)`: only from `NEEDS_MORE_PROOF`; increments `round` through the state machine and returns the submission to `IN_REVIEW` (via a new forensics pass for the supplement).
> - A job that sweeps drafts older than 24 hours with no files.
>
> Audit events are not available until Stage 5a. Leave a `shortcut:` comment at each state change naming 5a, as `castDecision` already does.
>
> Finish with the §8 report. Paste `pnpm check` and the `pnpm test:integration` output. STOP.

**What you check yourself:** upload a file whose extension says `.jpg` but whose
bytes are a PNG and confirm it is judged by its bytes; send a wrong
`client_sha256` and confirm the server's value is what is stored; confirm a
non-owner gets 404 on someone else's draft.

```bash
git commit -m "feat(intake): add draft, direct upload, finalize and supplement flow"
```

### Stage 4c — Forensics and scoring (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/10-FORENSICS.md` completely, `docs/02-ARCHITECTURE.md` §4.2, `docs/08-AI.md` (only to know what is out of scope here), `docs/salvage/` for the EXIF extractor, `docs/11-IMPLEMENTATION.md` §4 (#8 and #12), `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> The dHash pipeline is a frozen contract. The resize options are `DHASH_RESIZE` from `src/lib/forensics/dhash.ts` (9×8, `fit: "fill"`, `lanczos3`). Move the sharp half out of `scripts/seed.ts` into `forensics.service.ts`; both pass `DHASH_RESIZE` and neither writes a literal.
>
> Build, tests first:
> - `src/server/services/forensics.service.ts` — every deterministic stage in `docs/10-FORENSICS.md` §2, each writing a `forensic_finding` row with the exact severity from the table in §3 and a human-readable reason. Run as a registered job handler.
> - Duplicate search: SHA-256 exact, then Hamming `< 8` through the HNSW index across all tenants. The search is global; the **disclosure** is scoped: a cross-organisation match is an opaque reference, never the organisation or project.
> - Geofence: `ST_Covers` and `ST_DWithin` against `project_private_location`, reading exact geometry only through the one private function in `projects.service.ts`.
> - `src/lib/scoring/v1.ts` — a pure function over findings; `risk_score`, `risk_band` and `scoring_version` on `evidence_submission` are a cache written only through it, stored with the version, never rendered without its findings beside it, never gating a transition (`docs/10-FORENSICS.md` §6).
> - Tests: replay produces byte-identical deterministic findings (#12, never weakened); no cross-organisation identifier in any payload an unprivileged caller can reach (#8, `forensics-disclosure.test.ts`); the service's hash of each seeded pool image, read from storage, equals the `dhash` stored in the database.
> - Commit the eval fixture set (rotations, crops, recompressions, unrelated images) under `test/fixtures/forensics/`.
>
> Finish with the §8 report. Paste `pnpm check` and the `pnpm test:integration` output. STOP.

**What you check yourself**

| Check | How | If it fails |
|---|---|---|
| The seeded duplicate fires | Submit a draft whose image is a seeded pool image; a `HIGH` finding appears | Stop. This is the Stage 4 gate. |
| The disclosure test bites | Temporarily put the matching org name in a finding payload; the test must go red | It asserts nothing. |
| The kernel is shared | `grep -rn lanczos3 src scripts` shows `DHASH_RESIZE` only, no second literal | Kernel drift between callers silently breaks duplicates. |
| The score is a cache | `grep -rn risk_score src` shows writes only via scoring v1 | `docs/10` §6 broken. Restart the session. |

```bash
git commit -m "feat(forensics): add finding-based forensic pipeline and scoring v1"
```

### Stage 4d — Submit flow (Lane B)

> **You are Lane B.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane B paths. Do not edit services, schema, migrations, `package.json` or `src/app/api/**`. Do not commit; I commit. You run the one dev server; check for a running one first. You are authorised to write `public/offline-sw.js` and `public/offline.html` for this stage only.
>
> Read first: `docs/06-DESIGN-SYSTEM.md`, `docs/18-VISUAL-CORRECTION.md`, `docs/19-LAYOUT-SPEC.md`, `docs/14-PAGE-SPEC.md` page 6, `docs/15-UI-STATES.md` §4 and §5, `docs/05-ROUTES.md` §5, `docs/16-AMENDMENTS-v2.md` (this stage carries **A11**).
>
> Where the spec is silent, use judgment and say what you decided and why. Where a spec number produces something unreadable, measure it in the browser and make the call.
>
> Build `/projects/[id]/submit` against the real services: single column, mobile-first; client-side SHA-256 with `crypto.subtle` at selection time, shown and labelled as unverified; direct upload with the scoped token; the optional note and optional browser geolocation (labelled a weak signal); the pipeline stepper (queued, running, done, warning, failed, skipped) showing findings as they arrive; the IndexedDB offline queue with a clear "queued, will send when online" state. **A11:** the service worker caches exactly one static offline page and nothing authenticated, ever.
>
> Before you report, in a real browser at a phone width and at a desktop width: submit a file, drop the network mid-upload and confirm it queues and later sends; confirm sign-out leaves nothing of the tenant's in any cache or IndexedDB store.
>
> Finish with the §8 report. Paste `pnpm check`. STOP.

```bash
git commit -m "feat(intake-ui): add submit flow, offline queue and pipeline stepper"
```

### Stage 4e — Gate (you, then Lane A for fixes)

Run by hand and decide:

| Check | How |
|---|---|
| `HIGH` finding on a seeded duplicate | Sign in as the field submitter, submit a seeded pool image |
| Worker death is recoverable | Kill the dev server mid-job, restart, confirm the job completes |
| Disclosure | `forensics-disclosure.test.ts` green and shown red once |
| Offline | Network off in devtools, submit, network on, confirm it arrives |
| Nothing authenticated is cached | Application tab: only the offline page in Cache Storage |
| `pnpm check` and `pnpm test:integration` | Both green, run by you |

Do not approve Stage 5 until all six hold.

---

## Stage 5 — Evidence Lab and the audit chain

**Prerequisite:** Stage 4 accepted. `GEMINI_API_KEY` and `GEMINI_MODEL` are in
`.env.local` for 5c (the key may stay empty: the job must then report
`ai_unavailable`, not fail).

The second large stage. 5a to 5c and 5e are Lane A; 5d is Lane B.

### Stage 5a — The audit chain (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/02-ARCHITECTURE.md` §4.5, `docs/03-DATABASE.md` §5, `docs/11-IMPLEMENTATION.md` §4 (#5 and #6, never weakened), `docs/THREAT_MODEL.md`, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> `src/lib/crypto/` is frozen. The event-hash function must run in `scripts/` (which may import only `src/lib`) and in the services, so it belongs in `src/lib/crypto/`. Do **not** create it unprompted: write it, with known-answer vectors, and list it in CROSS-LANE REQUESTS for my approval, as `location.ts` was approved. Until I approve, keep it in `src/server/` and say so.
>
> Build, tests first:
> - `audit-chain.service.ts` — append inside the caller's transaction, `pg_advisory_xact_lock` per organisation, `seq` from the chain head, `prev_event_hash` and `event_hash` over RFC 8785 canonical JSON.
> - Wire it into every state change that exists: `castDecision`, `finalize`, `addSupplement`, project activation and closure. Remove the `shortcut:` comments they carry.
> - `scripts/verify-audit-chain.ts` — walks every organisation's chain and reports the first bad sequence number.
> - The seed must produce a valid chain, so the verification can run over the whole seeded dataset: extend `scripts/seed.ts`, or add `scripts/backfill-audit-chain.ts` for the already-seeded dev branch (the seed cannot be re-run).
> - Tests: a tampered row breaks verification at that exact sequence number (#6); concurrent appends to one organisation never fork the chain; `UPDATE` and `DELETE` on `audit_event` still raise.
>
> Finish with the §8 report. Paste `pnpm check`, the `pnpm test:integration` output and the verification script's output over the full dataset. STOP.

**What you check yourself:** the tamper test names the right sequence number;
run the verification script yourself and read its output; confirm the
hash function is in the place you approved.

```bash
git commit -m "feat(audit): add hash-chained audit log and chain verification"
```

### Stage 5b — Reviews, blind until vote (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/04-AUTH.md` §4, `docs/14-PAGE-SPEC.md` page 5, `docs/13-FEATURE-SPEC.md` B3, `docs/16-AMENDMENTS-v2.md` (this stage carries **A4**).
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> `castDecision` and `assertCanReview` exist and are tested; do not change their behaviour, only extend them. Build, tests first:
> - **A4:** a reviewer cannot read other reviewers' decisions or reasons for the current round until they have submitted their own. Add `getRoundDecisions(actor, submissionId)`: before the caller has voted it returns counts only; after, it returns the decisions. The queue overview already returns counts, never who. A test proves the second reviewer cannot see the first's reason before voting, in the service and through `GET /api/lab/queue`.
> - Decisions in earlier rounds stay visible to everyone allowed to see the submission (they belong to history).
> - Round resolution on `NEEDS_MORE_PROOF`: confirm quorum is evaluated over the current round only after a supplement; the existing test covers it, extend it through `addSupplement`.
> - Say in your report how the platform-admin gap in `docs/04-AUTH.md` §4 stands now; do not add an admin role.
>
> Finish with the §8 report. Paste `pnpm check` and the `pnpm test:integration` output. STOP.

```bash
git commit -m "feat(reviews): hide current-round decisions until the reviewer has voted"
```

### Stage 5c — AI advisory job (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/08-AI.md` completely, `docs/10-FORENSICS.md` §6, `docs/THREAT_MODEL.md` (the prompt-injection entry), `docs/11-IMPLEMENTATION.md` §4 (#10).
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Build `ai-audit.service.ts` as a job handler. The model name comes from `requireEnv("GEMINI_MODEL")`, never hard-coded. Output is schema-constrained with no free-text field through which instructions can flow back; it produces at most an `AI_OBSERVATION` finding at low weight. **The AI never mutates state:** it cannot approve, reject, score, or change a status. Put the Gemini client behind a port so tests use a fake; no test touches the network.
>
> Tests: a failed or absent AI call leaves the submission intact and reviewable (#10); a hostile string embedded in image metadata cannot change the output schema or any state; with no `GEMINI_API_KEY` the job records `ai_unavailable` as a neutral, non-error outcome.
>
> Finish with the §8 report. Paste `pnpm check`. STOP.

```bash
git commit -m "feat(ai): add advisory image audit job behind a port"
```

### Stage 5d — Lab on real evidence (Lane B)

> **You are Lane B.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane B paths. Do not edit services, schema, migrations, `package.json` or `src/app/api/**`. Do not commit; I commit. You run the one dev server; check for a running one first.
>
> Read first: `docs/06-DESIGN-SYSTEM.md`, `docs/18-VISUAL-CORRECTION.md`, `docs/19-LAYOUT-SPEC.md`, `docs/14-PAGE-SPEC.md` page 5, `docs/15-UI-STATES.md`, `docs/16-AMENDMENTS-v2.md` (**A4**, **A10**).
>
> The Lab's geometry, tiers and slider are settled and live-tested: do not redesign them. Replace what is still placeholder with the real thing: the images through `/api/evidence/[fileId]` in place of "The photographs are not available yet"; real findings in `FindingCard` (three tiers, plain language, nothing open on load); the blind-until-vote display (A4: counts before the reviewer's own vote, decisions after); the decision flow against `/api/lab/decision` with its real errors shown. The `?fixtures` development mode stays for design review.
>
> Where the spec is silent, use judgment and say what you decided and why. Measure before trusting a number.
>
> Before you report, in a real browser as `verifier1@delta-demo.example` and `verifier2@delta-demo.example`: both reach a real submission, see real images and findings, and the second does not see the first's reason until voting. As the funder and the owner: the empty state, never an error. Read it at 1280, 1440, 1920 and 390.
>
> Finish with the §8 report. Paste `pnpm check`. STOP.

```bash
git commit -m "feat(lab): show real evidence, findings and blind-until-vote decisions"
```

### Stage 5e — Gate (you)

| Check | How |
|---|---|
| Two verifiers reach `APPROVED` | `/demo` as verifier one, approve with a real reason; `/demo` as verifier two, approve; status is `APPROVED` |
| A split escalates | Approve with one, reject with the other: `ESCALATED`. Then sign in normally as `audit-admin@delta-demo.example` (not a `/demo` persona; password `delta-demo-2026`) and cast the deciding vote |
| An owner cannot review | Sign in as the field submitter, try `/api/lab/decision` on their own org's submission: 403 |
| The chain holds | Run `scripts/verify-audit-chain.ts` over everything yourself |
| It breaks when tampered | In a throwaway branch, alter one row and see the exact sequence number reported |
| `pnpm check` and `pnpm test:integration` | Both green, run by you |

Do not approve Stage 6 until the chain verifies over the whole dataset.

---

## Stage 6 — Contract and anchoring

**Prerequisite:** Stage 5 accepted. Foundry is installed (`forge --version`)
and the pinned OpenZeppelin version is chosen and logged in
`docs/DEPENDENCY_LOG.md` (the toolchain row is still blank). You put
`BASE_SEPOLIA_RPC_URL`, `ANCHOR_PRIVATE_KEY`, `ANCHOR_CONTRACT_ADDRESS` and
`NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local` yourself, with a funded
Base Sepolia key. **The agent never holds or writes the key.**

This stage creates the frozen cryptographic modules, so it has three hard stops:
after the crypto modules (6a), after the contract and before anything is
deployed (6b), and the deployment itself, which only you do (6c). No agent
holds the key or sends a real transaction.

### Stage 6a — The frozen modules (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/02-ARCHITECTURE.md` §4 completely, `docs/adr/ADR-0005-merkle-leaf-and-manifest-layout.md`, `docs/09-WEB3.md` §3 and §4, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Create, tests first, in `src/lib/crypto/`: the canonical manifest builder (`delta.manifest.v2`, with the `files` ordering and the always-four-keys rule), the RFC 8785 serialiser wrapper, and the Merkle leaf layout. Each gets known-answer vectors written by hand from the documents, not generated by the code under test, and committed as JSON that the Solidity tests will also read.
>
> **Stop here.** List every file in CROSS-LANE REQUESTS for my review. Once I approve they are frozen, as `location.ts` is. Do not build the contract or the anchor service in this step.
>
> Finish with the §8 report. Paste `pnpm check`. STOP.

**What you check yourself:** read the vectors against `docs/02-ARCHITECTURE.md`
§4.4 line by line, especially the ordering (`BEFORE`, `AFTER`, `SUPPLEMENT`,
then round, then sha256) and `dhash: null` rather than absent. This is the
last chance to change them.

```bash
git commit -m "feat(crypto): add canonical manifest, RFC 8785 serialiser and Merkle leaf"
```

### Stage 6b — The contract (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/09-WEB3.md` completely, `docs/adr/ADR-0001-custom-registry-vs-eas.md`, `docs/adr/ADR-0002-base-sepolia-vs-signed-log.md`, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Build `contracts/` as a Foundry project with `ImpactAnchorRegistry.sol` and the complete test matrix in §3, including the fuzz tests, reading the committed vectors. Also write `contracts/script/Deploy.s.sol` and the exact `forge script` command to run it, but **do not run it and do not deploy**: you do not hold the key.
>
> Finish with the §8 report. Paste `forge test -vvv` and `pnpm check`. STOP.

Read the Solidity yourself, line by line: access control, duplicate batches,
ownership, who can anchor. Then deploy, by hand:

```bash
git commit -m "feat(contracts): add impact anchor registry and test matrix"
```

### Stage 6c — Deploy (you, by hand)

The agent prepared the script; you hold the key. Run the command it gave you
with `ANCHOR_PRIVATE_KEY` and `BASE_SEPOLIA_RPC_URL` from your own environment,
then verify the source on BaseScan. Put the address in `.env.local` as
`ANCHOR_CONTRACT_ADDRESS` and `NEXT_PUBLIC_CONTRACT_ADDRESS`. Confirm on
BaseScan that the owner is the address you expect.

### Stage 6d — Anchor service (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/09-WEB3.md` §4 to §6 and §8, `docs/13-FEATURE-SPEC.md` D3, `docs/04-AUTH.md` §4, `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Build `anchor.service.ts`: manifest build, Merkle tree, `anchor_batch` and `anchor_leaf` rows with proofs written **before** the transaction is sent, viem send, receipt polling, `FAILED` and return-to-`APPROVED` on revert. Put the chain client behind a port. The key is read through `requireEnv("ANCHOR_PRIVATE_KEY")` in exactly one source file. Also the daily `GET /api/internal/anchor/daily` guarded by `CRON_SECRET`, and an admin "Anchor now" service call.
>
> **Tests run against a local `anvil` chain** with its well-known test key, never Base Sepolia, never a real key: a batch is reproducible from the public API; the unique `(submission_id, manifest_version)` index refuses a double anchor; a reverted transaction returns submissions to `APPROVED`; `ANCHORED` is reached only after the receipt confirms; the key appears in exactly one source file. Do not send a real transaction. I will press "Anchor now" myself.
>
> Finish with the §8 report. Paste `pnpm check`, the `pnpm test:integration` output and the anvil run. STOP.

```bash
git commit -m "feat(anchor): add Merkle batching and anchor service"
```

### Stage 6e — Admin anchor panel (Lane B)

> **You are Lane B.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane B paths. Do not edit services, schema or `src/app/api/**`. Do not commit; I commit. You run the one dev server; check first.
>
> Read first: `docs/06-DESIGN-SYSTEM.md`, `docs/18-VISUAL-CORRECTION.md`, `docs/19-LAYOUT-SPEC.md`, `docs/15-UI-STATES.md`, `docs/05-ROUTES.md` §3, `docs/16-AMENDMENTS-v2.md` (**A10**).
>
> Build the `/admin` anchor panel: pending count, batch table, "Anchor now", the `ChainAnchorPanel`, and the pending-anchor badge. Where the spec is silent, use judgment and say what you decided.
>
> Before you report, read it at 1280, 1440, 1920 and 390 in a real browser, in every state (nothing pending, pending, confirmed, failed).
>
> Finish with the §8 report. Paste `pnpm check`. STOP.

**Exit gate for Stage 6 — what you check before approving Stage 7:**

| Check | How |
|---|---|
| The contract is right | You read it: access control, duplicate batches, ownership |
| `forge test -vvv` | Green, run by you |
| The anvil run | The anchor service's tests pass against a local chain, never a real key |
| A real batch on Base Sepolia | You press "Anchor now" as the admin, not the agent |
| The chain agrees with the database | Open the BaseScan link; the on-chain root equals the root recomputed from the database |
| Source verified, key safe | The contract is verified on BaseScan; `grep -rn ANCHOR_PRIVATE_KEY .` finds exactly one source file and no secret value |

```bash
git commit -m "feat(admin): add anchor panel and pending-anchor badges"
```

---

## Stage 7 — Proof dossier and public API

**Prerequisite:** Stage 6 accepted, with at least one real `CONFIRMED` batch.

### Stage 7a — Proof service, API keys, verify lookup (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`.
>
> Read first: `docs/05-ROUTES.md` §4 and §6, `docs/09-WEB3.md` §7, `docs/13-FEATURE-SPEC.md` D4, `docs/04-AUTH.md` §7, `docs/16-AMENDMENTS-v2.md` (this stage carries **A7**).
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Build, tests first: the proof service and `GET /api/v1/submissions/[id]/proof` (public: canonical manifest, Merkle proof, fuzzed geometry and the commitment, never the salt); API keys per `docs/04-AUTH.md` §7 (prefix lookup, SHA-256 hash, constant-time compare, scoped, read-only, revoked by timestamp) guarding `/api/v1/projects`, `/api/v1/stats`; the funder read services (APPROVED or ANCHORED records of projects linked through `project_funder`, nothing else); the **A7** lookup service behind `/verify`: a proof id, a transaction hash, or a file SHA-256 (the browser hashes; only the hash arrives) returns a dossier link or no match.
>
> Tests: a manifest rebuilt from the database hashes to the anchored leaf; a funder cannot read an unlinked project or a pending submission; a revoked key stops working at once; the proof endpoint never returns the salt (extend `fuzzing-leak.test.ts`).
>
> Finish with the §8 report. Paste `pnpm check` and the `pnpm test:integration` output. STOP.

```bash
git commit -m "feat(proof): add proof service, api keys and verify lookup"
```

### Stage 7b — Proof pages (Lane B)

> **You are Lane B.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane B paths. Do not edit services, schema or `src/app/api/**`. Do not commit; I commit. You run the one dev server; check first.
>
> Read first: `docs/06-DESIGN-SYSTEM.md`, `docs/18-VISUAL-CORRECTION.md`, `docs/19-LAYOUT-SPEC.md`, `docs/14-PAGE-SPEC.md` page 4, `docs/15-UI-STATES.md`, `docs/05-ROUTES.md` §4, `docs/09-WEB3.md` §7, `docs/16-AMENDMENTS-v2.md` (**A7**, **A10**).
>
> Build `/proof/[id]` in the Paper theme with all eight sections in order; browser-side manifest recomputation using `src/lib/crypto` and Merkle verification via viem; the four verification states (`MATCH`, `MISMATCH`, `PENDING`, `UNAVAILABLE`), with `UNAVAILABLE` a neutral grey; the drop-the-original-photo verifier (hashed in the browser, say so on the page); the salted commitment with the exact-polygon unlock for authorised sessions; `/proof/[id]/print`; `/verify` per A7 with the careful no-match copy; the funder dashboard view. Write `test/e2e/manifest-hash.spec.ts`: the manifest hash is byte-identical in Node and in a real browser.
>
> Where the spec is silent, use judgment and say what you decided. Before you report, read every page at 1280, 1440, 1920 and 390, signed out, in every state.
>
> Finish with the §8 report. Paste `pnpm check` and the Playwright output. STOP.

**Exit gate for Stage 7 — what you check yourself:** open the proof page in a
private window with no session, drop the original photo, see green. Then point
`BASE_SEPOLIA_RPC_URL` at a dead host and confirm `UNAVAILABLE`, not `MISMATCH`.
Drop a different photo and confirm `MISMATCH`. Print the certificate. Confirm no
salt or exact coordinate is in the page source.

```bash
git commit -m "feat(proof): add public proof dossier with client-side verification"
```

---

## Stage 8 — Evidence, polish, ship

**Prerequisite:** Stage 7 accepted. Docker Desktop is installed. The local image
(`postgis/postgis:18-3.6` plus pgvector) and the whole integration suite were
verified against it on 2026-11-03 (`docs/DEPENDENCY_LOG.md`), but later stages
add migrations and tests, so repeat the check by hand before any load test. On
this machine `docker` is not on the shell's PATH; add
`C:\Users\orgho\AppData\Local\Programs\DockerDesktop\resources\bin`.

```bash
docker compose up -d
DATABASE_URL_UNPOOLED=postgresql://delta:delta_local@localhost:5432/delta pnpm db:migrate
```

Then run the integration suite against it. If the image, the volume path or the
migrations misbehave, that is Stage 8's first finding, not a surprise at k6 time.

### Stage 8a — Evidence and the numbers (Lane A)

> **You are Lane A.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane A paths. Do not touch `src/components/**` or `src/app/**/*.tsx`; ask for those under CROSS-LANE REQUESTS. Do not commit; I commit. Use the Neon `dev-spike` branch for database work and never the `production` branch. Never run `drizzle-kit push`. Never print or edit `.env.local`. Never run load tests against the Neon hosted branches; local Docker only.
>
> Read first: `docs/10-FORENSICS.md` §7 and §8, `docs/11-IMPLEMENTATION.md` §Stage 8, `docs/THREAT_MODEL.md`, `docs/04-AUTH.md` §4 (the platform-admin note), `docs/16-AMENDMENTS-v2.md`.
>
> Where the spec is silent, use your judgment and say in your report what you decided and why. Where following it would produce something that reads or behaves badly, make the call and say so instead of following it into a bad result.
>
> Build: `scripts/eval-forensics.ts` over the committed fixtures, writing real precision and recall to `docs/FORENSIC_EVAL.md` **and** a machine-readable `docs/FORENSIC_EVAL.json` that `/trust` reads at build time, including the known misses (90° rotation, heavy crops) stated plainly. `scripts/replay-forensics.ts`. k6 against local Docker with the 5,200 seeded rows, p95 for the Hamming and spatial queries, written into `README.md`. The tamper-demo service behind `DEMO_MODE` (breaks one sandbox audit row and shows verification failing). `README.md` from `docs/00-PRODUCT.md`, with "what this does not prove" verbatim and a threat-model summary.
>
> **Ask before building:** the platform-admin role does not exist in the schema, so the test in `docs/04-AUTH.md` §4 proves only that no voting path exists. Propose, in your report, how an admin should be represented and what test would prove an admin cannot vote. Do not add the role in this step.
>
> Finish with the §8 report. Paste the eval table, the k6 numbers and `pnpm check`. STOP.

```bash
git commit -m "docs: add forensic evaluation, load test results and project README"
```

### Stage 8b — Trust page, demo path, accessibility (Lane B)

> **You are Lane B.** Read `CLAUDE.md`, `docs/12-AGENT-SCOPE.md` and `docs/17-AGENT-LANES.md` first. Write only to Lane B paths. Do not edit services, schema or `src/app/api/**`. Do not commit; I commit. You run the one dev server; check first.
>
> Read first: `docs/06-DESIGN-SYSTEM.md`, `docs/18-VISUAL-CORRECTION.md`, `docs/19-LAYOUT-SPEC.md`, `docs/15-UI-STATES.md`, `docs/05-ROUTES.md`, `docs/11-IMPLEMENTATION.md` §3 and §Stage 8, `docs/16-AMENDMENTS-v2.md` (**A8**, **A10**, **A14**).
>
> Build `/trust` per A8: what Delta proves and does not prove verbatim from `docs/00-PRODUCT.md`, every finding kind and its severity rule as a table, the **measured** precision and recall read from `docs/FORENSIC_EVAL.json` (never prose), the threat-model summary, and the **A14** limitation stated plainly (no email, no password reset). Write `test/e2e/demo-path.spec.ts` covering the full six-step demo. Do the accessibility pass: contrast on both themes (compute every pairing; fix the token, do not waive the check), full keyboard operation, 320 px width, 200 % zoom.
>
> Where the spec is silent, use judgment and say what you decided. Before you report, read every page in a real browser at 320, 390, 1280, 1440 and 1920.
>
> Finish with the §8 report. Paste the Playwright output and `pnpm check`. STOP.

```bash
git commit -m "feat(trust): add trust page, demo path test and accessibility pass"
```

### Stage 8c — Ship (you, by hand)

The agents do not deploy. You: set the environment variables on Vercel; apply
the migrations to the production Neon branch yourself; run `pnpm build` and
fix what it finds; seed a demo database (never production); confirm `DEMO_MODE`
is set only where you want the switcher. If Vercel refuses pnpm 11, the
fallback to pnpm 10 is pre-approved; log the error. Then merge to `main`.

**Exit gate for Stage 8 — what you check:** a stranger with only the URL
completes the demo path unaided; the eval numbers on `/trust` match
`docs/FORENSIC_EVAL.md`; `pnpm check`, `pnpm test:integration` and the
Playwright suite are green, run by you, against local Docker as well as Neon.

---

## Carry-overs — what each stage inherits

Things the agents will otherwise rediscover. If a prompt above does not say it,
this table does.

| From | Carry-over | Lands in |
|---|---|---|
| Stage 2 | `castDecision` appends no audit event | 5a |
| Stage 2 | No platform-admin role in the schema; the §4 test proves only that no voting path exists | 8a (propose), then your decision |
| Stage 2 | Seeded data has no findings, manifests, anchors or audit events | 4c, 5a, 6c |
| 1e / auth | Everyone lands on `/lab` | 3c |
| Lab | Real queue shows "photographs are not available yet" | 3a (upload), 5d (show) |
| Seed | Seed cannot be re-run; fixes to seeded data need a backfill script | every stage that touches seed data |
| Seed | Demo password `delta-demo-2026` is public by design; seed refuses `production` | — |
| Env | Deferred variables arrive by stage: `BLOB_READ_WRITE_TOKEN` 3, `CRON_SECRET` 4, `GEMINI_*` 5, chain keys 6 | you, in `.env.local` |
| Toolchain | Foundry and OpenZeppelin versions not yet logged | 6 |
| Infra | Docker image and volume path untested; suite never run on Docker | 8 pre-flight |
| Network | From this machine to Neon, `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000` is baked into `test:integration` and `db:seed`; export it by hand for `db:migrate` and `db:check-typmod` | — |
| Frozen | `src/lib/crypto/location.ts` is frozen; the dHash options (`DHASH_RESIZE`) are frozen | — |
| Docs | docs/19 §6: the selected queue row is `--field-muted`, decided; do not reopen | — |

---

## If the agent goes off the rails

Signs to watch for:

| Sign | What it means |
|---|---|
| Proposes `@neondatabase/serverless` | Skipped `docs/03-DATABASE.md` §1.1. Restart the session. |
| Writes `risk_score` from anywhere but `src/lib/scoring/`, renders it without its findings, or lets it gate a transition | Skipped the four conditions in `docs/10-FORENSICS.md` §6. Restart. |
| Builds UI before the service passes tests | Broke the Stage ordering law. Revert and re-prompt. |
| Adds an admin override on review | Broke M2. Revert immediately, this is the product. |
| Says "done" without pasting test output | Do not believe it. Ask for the output. |
| Touches `src/lib/crypto/` without asking | Revert. Propose-only once frozen; new files need your approval first. |
| Uses `--no-verify` on a commit, or commits at all | Scope violation. Revert and re-prompt. |
| Writes outside its lane (`FILES WRITTEN` shows it) | `docs/17` §9. Revert that file. |
| Weakens, skips or deletes a test to make it pass | Break the "never weakened" rule. Revert, make it fix the code. |
| Reads, prints or edits `.env.local` | Credentials. Stop the session, rotate anything it printed. |
| Runs `drizzle-kit push`, or points anything at the `production` Neon branch | Stop. Check the branch before anything else. |
| Starts a second `next dev`, or kills one it did not start | One dev server, Lane B's. Ask first. |
| Follows a layout number into something unreadable and reports it as done | Make it open the page and measure. The Lab's 20-character column is the precedent. |
| Reports a UI stage without having looked at it in a browser | It has not verified anything. Make it do so and report what it saw. |
| Treats a flaky connection error as a logic bug (or hides one) | The link to Neon drops connections now and then. Retry once; if it persists, report it with the log line. |

Restarting a session is cheaper than correcting one that has already ignored
the contract once. Context rot is real; a fresh session re-reads the docs.
