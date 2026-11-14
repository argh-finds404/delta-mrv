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

**Date of this update:** 2026-11-14, fifth update (wrap-up). Run for it, all passing:
`pnpm check` (ESLint with no warning, 264 unit tests in 17 files), `pnpm test:integration` on
local Docker (166 tests in 22 files), `pnpm build`, `pnpm test:e2e` (3 specs) against the local
stack with migration `0005` applied, and `pnpm contracts:test` (16 tests).

| Stage | Status |
|---|---|
| 1 - Toolchain, schema, PostGIS/Hamming spike, Better Auth | **Done** |
| 2 - State machine, tenancy, conflict-of-interest, seed | **Done - gate green** |
| 3 - Atlas, public read path, blob storage | **Done** |
| 4 - Intake, job queue, forensics, scoring v1 | **Done** |
| 5 - Audit chain, Evidence Lab, quorum review, AI advisory | **Done** |
| 6 - Contract and anchoring | **Built and tested on a local chain. Not deployed to Base Sepolia** |
| 7 - Proof dossier, public API, API keys, funder view | **Built** |
| 8 - Evidence, polish, E2E, ship | **Eval write-up, replay, chain verification, query timings, tamper demo, contrast, keyboard, 320 px and 200 % zoom pass, README: done.** k6 and deploy: not done |

**Built since the last update:** `contracts/` (Foundry; `ImpactAnchorRegistry.sol`, 16 tests
reading the committed vectors); manifest sealing at approval; `anchor.service` behind a chain
port, the daily cron route and the `/admin` anchor panel; the proof page's in-browser
verification against the contract; the public proof API; API keys (`dmrv_...`) and
`/api/v1/stats`; the funder section of `/dashboard`; a local-disk evidence store for
development; `pnpm dev:local` (Docker database + anvil + local storage); the hero built from
the maintainer's watercolour illustrations.

**Built in the second update (Stage 8):**

- `pnpm eval:forensics` writes `docs/FORENSIC_EVAL.md` from the same measurement the suite
  asserts. `/trust` still reads `src/lib/forensics/eval-results.ts`, not a JSON file.
- `pnpm forensics:replay <submissionId>` and `pnpm audit:verify`. Scripts may not import
  `src/server`, so each script starts a one-file vitest run from `test/tools/`.
- `pnpm bench:queries`: p50 and p95 of the duplicate search and the geofence check on local
  Docker. It stands in for k6, which speaks HTTP and has no endpoint to aim at for either query.
- `.github/workflows/scheduled.yml`: hourly drain and daily anchor. It does nothing until the
  repository secrets `APP_URL` and `CRON_SECRET` are set.
- `public/sw.js`, `public/offline.html` and their registration (docs/16 A11), production only.
- `test/contrast.test.ts` (docs/16 A10). It failed on first run, so the tokens changed:
  `--signal`, `--verified`, `--verified-fill`, `--chain`, `--review`, `--fraud` and three
  status hues in `src/lib/status.ts` are darker. **Look at the pages and say if a hue is wrong.**
- Keyboard: `* { box-shadow: none !important }` was cancelling every `ring-*` focus indicator;
  controls that drop their outline now get one back. The photo pickers on the submit form and
  the proof page were mouse-only and now take Enter and Space.
- `README.md` rewritten from `docs/00-PRODUCT.md`: the overclaims are gone, the measured
  numbers and the threat-model summary are in.

**Built in the third update:**

- `/submissions/[id]` (docs/14 §7): decisions and reasons first, then the stored originals with
  their fingerprints, findings, the site, the anchor and the audit trail. Owner and assigned
  verifier only; a linked funder gets a 404 and reads the proof page. Linked from the project
  page and from "Needs your attention".
- `/projects/[id]/manage`: description, close the project, who reviews it. **New service rule:**
  the name, the claim and the tolerance cannot change once evidence has been sent, because the
  proof page shows them beside approvals the reviewers gave for the old values
  (`test/integration/project-manage.test.ts`).
- `/admin` has the job queue (M6): counts, the jobs that stopped, and "Retry stopped jobs".
- The review workspace showed no photographs for any record in round 2 or later, never showed a
  supplement, and labelled a file's id as its SHA-256. It now shows the latest pair, the
  supplements, and the real fingerprint, capture time and position.
- Invitations (docs/04 §2, A14): a "People" panel on `/dashboard` for owners and admins, a link
  shown once, a one-step sign-up for the invited person, and the join card at
  `/dashboard?invite=<id>`. This is the auth library's invitation flow; the link works only for
  an account with the invited address, for 48 hours.
- The offline capture queue is cleared at sign-out (A11), after a confirmation when it holds
  unsent work.
- `.githooks/pre-commit`: the secret scan passed every large commit unscanned (`grep -q` under
  `pipefail`). It now scans file by file and names the file. The local Docker URL is exempt;
  nothing else is, so a change to `test/fixtures/crypto/vectors.json` will be refused.
- `LICENSE` (Apache-2.0, as the README already said), a not-found page, a workspace error page.
- `docs/05-ROUTES.md` now lists the routes that exist, and marks the ones that do not.

**Built in the fourth update (2026-11-14):**

- **Operators** (`OPERATOR_EMAILS`, `src/server/services/operators.ts`): `/admin`, anchoring,
  the job queue, the tamper demo and reviewer assignment are theirs alone. A verifier
  organisation's admin can no longer assign itself a project, which closes the two-accounts
  self-approval route in §7. With `DEMO_MODE` the seeded demo admin is an operator.
- Owners ask for a reviewer on `/projects/[id]/manage`; operators see requests first and assign.
- matchRef resolution on `/admin`, recorded on the flagged side's chain; reviewers see the
  conclusion on the finding, with a "Copy ref" button beside each reference.
- S10 webhooks cut. A stale session cookie now keeps `?next=` (regression test).
- `/p/[id]` uses the site header and footer and the verbatim limits; its "proof" link pointed a
  project id at the proof page and 404'd, it now lists the real proofs. The proof page has a
  four-step custody strip and a BaseScan button. The Lab has filter pills, a round switch,
  an error-level lens (X3) and a live reason hint. The submit form shows per-file upload
  progress. Lint finishes with no warning.
- **X1** satellite cross-check (migration `0005`): run live on 2026-11-14 against two demo
  sites, about 7 s and 2 MB each. **X2** device-signed capture (same migration).
- Thirteen unreachable files deleted: the component barrel, the design-review fixture files,
  and the unused `QuorumMeter` and `skeletons` components.

**Fifth update, the wrap-up review (2026-11-14):**

- The satellite check fetched whatever band-file URL the catalogue's answer named, and accepted a
  whole-file answer. It now reads only from the Sentinel-2 archive's host, refuses redirects, and
  takes only a partial (206) answer (`test/satellite.test.ts`).
- A device signature whose base64 had a length of 4n + 1 threw inside finalize and failed the
  whole submission; it is now recorded as unverified, as designed (`test/capture-signature.test.ts`).
- `pnpm dev` or `pnpm dev:local` started from a lower-case drive (`d:\`, as VS Code's terminal
  does) reloaded every page about every 300 ms: Next's dev MCP file logger wrote browser console
  lines into `.next/dev/logs`, and the watcher took that for a source change.
  `experimental.mcpServer` is now off in `next.config.ts`.
- Driven in a browser on the local stack for the first time: a device-signed submission (valid on
  `/submissions/[id]` and re-checked on `/proof/[id]`), a real round 2 (sent back for more proof,
  a supplement, the round switch, two approvals), and an offline draft through the dashboard
  banner and the sign-out warning (cancel keeps it, accept clears it).

**Not built or not done:**

- The Base Sepolia deployment and a real batch; the hosted deployment. Both by hand.
- Migration `0005` is applied to local Docker only. Apply it to the Neon dev branch with
  `pnpm db:migrate` (direct URL in the environment) before deploying.
- X2 is a browser-held key, not WebAuthn or a hardware attestation, and reads no C2PA.
- k6: `pnpm bench:queries` stands in for it.

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
- **Operators and email verification.** Email verification is off, so whoever registers an
  address first owns it. Create each operator account before listing its address in
  `OPERATOR_EMAILS` on a deployment others can sign up to. On a `DEMO_MODE` deployment the
  seeded `audit-admin@delta-demo.example` is an operator: seed before opening sign-up.
- An operator who is also a member of a verifier organisation can assign that organisation.
  Operators are trusted staff; the conflict-of-interest rule still governs every vote.
- The satellite cross-check compares two dates whatever the season: the reviewer note says so,
  and the numbers swing (a flooded haor reads below zero in October).
- `docs/18-VISUAL-CORRECTION.md` labels `PERCEPTUAL_MATCH_SAME_ORG` "Matches your
  organisation's other project". A reviewer reads that as their own organisation. Left as the
  doc says.
- The invitation browser test adds one member to the demo verifier organisation in the local
  database on every run.
- Seeded rows (the 5,200 of history and the hand-made narrative records) were written by SQL,
  not by the pipeline, so `pnpm forensics:replay` fails on them by design. Replay a record that
  went through intake: all three in the local database replay byte for byte.
- The pending labels of the pipeline stepper use `--field-inert` (2.8:1). Treated as an
  inactive state; raise it if they should read as text.
- `docker` is not on the Git Bash PATH; it lives at
  `C:\Users\orgho\AppData\Local\Programs\DockerDesktop\resources\bin`.

---

## 8. What to do next

1. Read `contracts/src/ImpactAnchorRegistry.sol`, then deploy it to Base Sepolia by hand with
   the command in `contracts/script/Deploy.s.sol`, verify it on BaseScan, and set
   `BASE_SEPOLIA_RPC_URL`, `ANCHOR_PRIVATE_KEY`, `ANCHOR_CONTRACT_ADDRESS` and
   `NEXT_PUBLIC_CONTRACT_ADDRESS`. Press "Anchor now" as the audit admin.
2. After deploying, set the repository secrets `APP_URL` and `CRON_SECRET` so
   `.github/workflows/scheduled.yml` starts calling the two internal routes.
3. Register your operator account, then set `OPERATOR_EMAILS` on the deployment (§7).
4. Apply migration `0005` to the hosted database, and set `NDVI_ENABLED=true` if the
   satellite cross-check should call the public archive.
5. Look at the workspace with the darker status colours and say if a hue is wrong.

Local development: `docker compose up -d`, then `pnpm dev:local`.

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
