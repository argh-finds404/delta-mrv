# Delta MRV — Session Handoff

**Date:** 2026-11-03
**Maintainer:** Shoumik Orgho (`argh-finds404`), `orghodutta@gmail.com`
**Repo:** `github.com/argh-finds404/delta-mrv` (public)
**Branch:** `main` is current. Work on `stage-3/atlas` next.

Paste this whole file into a new chat to resume. Everything else lives in
`docs/` in the repository.

---

## 1. What this is

Delta MRV — a multi-tenant environmental Measurement, Reporting &
Verification platform. NGOs submit before/after photo evidence of restoration
work; a forensic pipeline flags suspicious evidence; **independent verifier
organisations** review it; approved evidence is Merkle-batched and anchored to
Base Sepolia so anyone can verify it in a browser.

Portfolio project. **$0/month operating cost is a hard constraint.**

The one line that matters:

> Delta turns environmental restoration claims from *things people say* into
> *things anyone can check*.

---

## 2. Current state

| Stage | Status |
|---|---|
| 1 — Toolchain, schema, PostGIS/Hamming spike, Better Auth | **Done** |
| 2 — State machine, tenancy, conflict-of-interest, seed | **Done — gate green** |
| Auth wiring + Evidence Lab UI | **Done** (pulled forward, unscheduled) |
| Docker local database | **Done** |
| 3 — Atlas, public read path, blob storage | **Next** |
| 4–8 | Not started |

**Tests:** 74/74 integration, 132 unit. All green on local Docker in 13s.

**Built and working:** full schema with append-only enforcement, Better Auth
with three organisation types, the conflict-of-interest rule with 27 tests,
tenancy isolation with 26 tests, seed data (3 orgs, 4 projects, 5,200
submissions, 10,400 evidence files), the design system, eleven primitive
components, auth pages wired to real sessions, and the Evidence Lab reading
real queue data.

**Not built:** blob storage, the forensic pipeline, the job queue, the audit
chain, the smart contract, anchoring, the proof dossier, `/dashboard`,
`/projects/new`.

---

## 3. The documents are the contract

All in `docs/`. The agent reads them; so should you before overriding
anything.

| File | Covers |
|---|---|
| `CLAUDE.md` | Index and the five overriding rules |
| `16-AMENDMENTS-v2.md` | Overrides numbered docs it names |
| `17-AGENT-LANES.md` | Path ownership between the two agents |
| `18-VISUAL-CORRECTION.md` | Palette v2 and the three-tier density contract |
| `19-LAYOUT-SPEC.md` | Pane widths, text measure, spacing scale |
| `00`–`15` | Product, features, architecture, database, auth, routes, design, dependencies, AI, web3, forensics, implementation, agent scope, feature spec, page spec, UI states |
| `AGENT_PROMPTS.md` | **Stage 3–8 prompts, ready to paste** |
| `THREAT_MODEL.md`, `adr/0001`–`0005` | Security model, five decisions |

**`docs/AGENT_PROMPTS.md` is the working file.** Stages 3–6 are split into
lettered steps (3a–3c, 4a–4e, 5a–5e, 6a–6e); 7 and 8 have two prompts each.
Each has an exit gate and a "what you check yourself" table. Copy the next
prompt straight from it.

---

## 4. How the work runs

**Two agents, strict path ownership** (`docs/17-AGENT-LANES.md` §2):

| | Lane A — Claude Code | Lane B — Antigravity |
|---|---|---|
| Owns | `src/server/**`, `src/lib/crypto/**`, `src/app/api/**`, `contracts/`, `drizzle/`, `scripts/`, migrations, `package.json` | `src/components/**`, `src/app/**/*.tsx`, `globals.css`, `src/lib/utils.ts` |
| Runs migrations | Yes, exclusively | Never |
| Installs packages | Yes, exclusively | Never |
| Dev server | Never | Yes, exclusively |

**Rules that prevent damage:**

- **Neither agent commits.** They report; the maintainer commits per lane.
- Check `FILES WRITTEN` in every report. A path outside the lane gets
  reverted, not merged.
- Every prompt ends with **STOP**. An agent that continues past it gets a
  fresh session rather than a correction.
- Reports use the `docs/17-AGENT-LANES.md` §8 format.

**Claude Code has earned trust.** It has caught its own mistakes unprompted
three times (a leaked credential, an unverified pgvector claim, two tests that
passed by accident), found a Feature Lock violation nobody asked it to look
for, and run a mutation check on the conflict-of-interest suite. Give it room
to exercise judgment — the standard clause is *"where the spec is silent, use
your judgment and say what you decided and why."*

**Antigravity executes literally.** It follows the spec exactly and makes no
judgment calls where the spec is silent. Give it precise, numbered work —
propagating an established pattern, not inventing one.

---

## 5. Environment

```
.env.local (not committed)
  DATABASE_URL           local Docker, or Neon dev-spike
  DATABASE_URL_UNPOOLED  same
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  NEXT_PUBLIC_CHAIN_ID=84532
  DEMO_MODE=true
```

- **Local Docker is the default for development.** `docker compose up -d`.
  13 seconds for the full suite versus 16 minutes against Neon.
- **Neon `dev-spike` branch** for anything needing the hosted path. The
  connection from Bangladesh is flaky — 5–8s per call, occasional drops.
- **Never touch the Neon `production` branch.** Its password was rotated
  2026-11-02 after an agent printed it in a transcript.
- Demo accounts: `delta-demo-2026`. Verifier One, Verifier Two, Audit Admin,
  plus owner and funder.

**Stack:** Next 16, React 19, Tailwind 4, Drizzle 0.45 over **postgres.js**
(never the Neon HTTP driver — it cannot run transactions), Better Auth 1.7,
PostGIS + pgvector, `@google/genai`, viem, Foundry, pnpm 11.

---

## 6. Decisions made in conversation

These are in the docs but worth knowing so they are not re-litigated:

1. **Quorum:** 2 approvals → `APPROVED`; 2 rejections → `REJECTED`; a 1/1
   split → `ESCALATED`, resolved by an admin **inside an assigned verifier
   org**. No platform-admin override exists.
2. **`ST_Covers`, not `ST_Contains`** — geography-native, uses the GiST index,
   and counts a point on the boundary as inside.
3. **`geography`, not `geometry`** — metres on a sphere with no reprojection.
4. **No `risk_score` that decides anything.** It is a cached value written only
   by a pure versioned function, always shown beside the findings that produced
   it, and it never gates a transition.
5. **Cross-org duplicate findings disclose nothing** — distance and an opaque
   `matchRef` only. Resolution is admin-only and writes an audit event.
6. **dHash kernel is `lanczos3` with `fit: "fill"`**, exported as a single
   shared `DHASH_RESIZE` object. A drift here silently breaks duplicate
   detection.
7. **Manifest is `delta.manifest.v2`** — `files: [{role, round, sha256, dhash}]`
   sorted BEFORE/AFTER/SUPPLEMENT, then round, then sha256. All four keys
   always present; `dhash` is JSON `null` when absent.
8. **Palette v2:** near-neutral surfaces, five distinct semantic hues, badges
   as 14% tints with a dot — never solid fills. One `--signal` element per
   screen.
9. **Three-tier density:** verdict / numbers / artefacts. Only tier 1 visible
   by default. No database enum ever reaches the screen.
10. **No Google OAuth.** Email and password only. The demo deck covers
    evaluators.
11. **Stage 6 deploys by hand** — an agent never holds the anchor key.
12. **Every commit is authored solely by the maintainer.** No AI co-author
    trailers, no "Generated with" lines, no emoji. Enforced by
    `.githooks/commit-msg` and `pre-commit`. Don't let an agent write a PR body.

---

## 7. Known carry-overs

- The **pooled connection path is only exercised on Neon.** Local Docker has
  no pgbouncer, so `prepare: false` is untested locally.
- The **seed has not run against Docker.**
- `/sign-in` links to `/demo` even when `DEMO_MODE` is off, which 404s.
- Everyone lands on `/lab` after auth because `/dashboard` does not exist yet.
- No **platform admin role** in the schema. The COI test proves only that no
  voting path exists for a user with no organisation.
- The **session-expired screen** has never been exercised.
- `/projects/new` is deferred — seed data covers testing, but nobody but the
  maintainer can create a project until it exists.
- `docker` is not on the Git Bash PATH; it lives at
  `C:\Users\orgho\AppData\Local\Programs\DockerDesktop\resources\bin`.

---

## 8. What to do next

1. Commit the Docker fix, push.
2. `git checkout main && git pull && git checkout -b stage-3/atlas`
3. Open `docs/AGENT_PROMPTS.md`, copy **Stage 3a**, paste into Claude Code.
4. Run the seed against local Docker so Stage 3 has data.

**Stage 3 builds:** the `StoragePort` with blob storage, `/atlas` with
MapLibre over PostGIS polygons, `/p/[slug]` public project pages, read-only
`/api/v1`, and the coordinate-fuzzing leak test.

**The design moment in Stage 3 is 3b**, when the map is built. It is the one
screen with no Evidence Lab precedent to copy, so the maintainer reviews it
before anything propagates.

**Install nothing, decide nothing, merge nothing** without checking it against
the documents above.

---

## 9. What to expect from me in the new session

Bring decisions, not every turn. The prompts are in the file now.

Come back when:

- An agent reports something that needs a judgment call
- A design surface needs review (3b the Atlas, 7 the proof dossier)
- A spec turns out to be wrong — which has happened repeatedly, and is mine
  to fix, not the agent's to work around
- A stage gate fails

Most of what has gone wrong in this project has been specification gaps, not
agent failure: an all-green palette, a 20-character text column, missing
density tiers, an incomplete amendment list. When output looks wrong, check
the document before blaming the agent.
