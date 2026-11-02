# Start here — what to do today

Current repository state, read from the file tree of 2 Nov 14:33:

| Problem | Fix |
|---|---|
| Docs are in `delta-mrv-scope/` | Claude Code reads `CLAUDE.md` from the **root**. Move them. |
| Two `AGENTS.md` files | One contract, or the agents follow whichever they read last. |
| Docs 13, 14, 15, 16, 17 missing | Not committed yet. |
| `.githooks/` missing | Authorship rules are unenforced. |
| `package-lock.json` present | Forbidden. npm and pnpm in one repo is a drift source. |
| Old implementation present | Built on a driver that cannot hold a transaction. |

Nothing has been executed. Start at step 1.

---

## Step 1 — Assemble the doc set (by hand, ~10 min)

From the four zips I sent you, the final layout is:

```
delta-mrv/
├── CLAUDE.md                      ← root. Claude Code auto-reads this
├── AGENTS.md                      ← root. Antigravity auto-reads this
├── .githooks/
│   ├── commit-msg
│   └── pre-commit
└── docs/
    ├── 00-PRODUCT.md
    ├── 01-FEATURE-LOCK.md
    ├── 02-ARCHITECTURE.md
    ├── 03-DATABASE.md
    ├── 04-AUTH.md
    ├── 05-ROUTES.md
    ├── 06-DESIGN-SYSTEM.md
    ├── 07-DEPENDENCIES.md
    ├── 08-AI.md
    ├── 09-WEB3.md
    ├── 10-FORENSICS.md
    ├── 11-IMPLEMENTATION.md
    ├── 12-AGENT-SCOPE.md
    ├── 13-FEATURE-SPEC.md         ← from delta-docs-13-15.zip
    ├── 14-PAGE-SPEC.md            ← from delta-docs-13-15.zip
    ├── 15-UI-STATES.md            ← from delta-docs-13-15.zip
    ├── 16-AMENDMENTS-v2.md        ← sent separately
    ├── 17-AGENT-LANES.md          ← sent separately
    ├── AGENT_PROMPTS.md           ← sent separately
    ├── DEPENDENCY_LOG.md
    ├── THREAT_MODEL.md
    ├── INSTALL.md
    └── adr/ADR-0001 … ADR-0005
```

Commands:

```bash
cd d:/Delta-MRV
git checkout main && git pull
git checkout -b rebuild/foundation

# Delete the old root contract — skim it first for anything
# the numbered docs do not cover, and move that content in
git rm -f AGENTS.md

# Promote the doc set to the root
git mv delta-mrv-scope/CLAUDE.md  CLAUDE.md
git mv delta-mrv-scope/AGENTS.md  AGENTS.md
git mv delta-mrv-scope/docs       docs
git mv delta-mrv-scope/INSTALL.md docs/INSTALL.md
rmdir delta-mrv-scope

# Now copy 13, 14, 15, 16, 17, AGENT_PROMPTS.md into docs/
# and .githooks/ into the root, from the zips

chmod +x .githooks/*
git config core.hooksPath .githooks
git config user.name  "Shoumik Orgho"
git config user.email "orghodutta@gmail.com"
```

### Then edit `CLAUDE.md` by hand

Replace the document-map table with this. Two new rows at the top; five new
rows at the bottom.

```markdown
| File | Authority over |
|---|---|
| **`docs/16-AMENDMENTS-v2.md`** | **Read first.** Overrides any numbered document it names |
| **`docs/17-AGENT-LANES.md`** | **Read first when another agent is running.** Path ownership |
| `docs/00-PRODUCT.md` | Vision, problem, users, product boundary, honesty clauses |
| **`docs/01-FEATURE-LOCK.md`** | What may be built |
| **`docs/02-ARCHITECTURE.md`** | Layering, folder structure, cryptographic contracts |
| **`docs/03-DATABASE.md`** | Schema, extensions, indexes, append-only enforcement |
| **`docs/04-AUTH.md`** | Better Auth, tenancy, roles, conflict-of-interest rule |
| `docs/05-ROUTES.md` | Every route, its guard, its data source |
| **`docs/06-DESIGN-SYSTEM.md`** | Tokens, type, motion, components, interaction |
| **`docs/07-DEPENDENCIES.md`** | Pinning contract, forbidden packages, toolchain |
| `docs/08-AI.md` | Gemini advisory contract and its hard limits |
| `docs/09-WEB3.md` | Contract, Merkle batching, anchoring, chain reads |
| `docs/10-FORENSICS.md` | SHA-256, dHash, EXIF, PostGIS, severity rules |
| `docs/11-IMPLEMENTATION.md` | Build order, definition of done, testing strategy |
| **`docs/12-AGENT-SCOPE.md`** | What you may and may not do. **Git authorship** |
| `docs/13-FEATURE-SPEC.md` | What each feature does, why, and how to build it |
| **`docs/14-PAGE-SPEC.md`** | What goes on each page and in what order |
| **`docs/15-UI-STATES.md`** | Empty, loading, offline, progress, error, auth states |
| `docs/AGENT_PROMPTS.md` | The maintainer's stage-by-stage prompt sequence |
| `docs/THREAT_MODEL.md` | Adversaries and mitigations |
| `docs/DEPENDENCY_LOG.md` | Registry verification log — append on every install |
| `docs/adr/` | ADR-0001 … ADR-0005 |
```

Commit:

```bash
git add -A
git commit -m "docs(scope): move architecture contract to root and add v2 amendments"
```

If the hooks reject this commit, they are working. Read the error and fix the
message.

---

## Step 2 — Fold in the schema amendments (Opus, ~15 min)

**Six amendments change the schema. They must land before any migration
exists**, or Stage 1c generates a schema you throw away.

Paste into Claude Code:

> Read `docs/16-AMENDMENTS-v2.md` completely. It overrides the numbered documents it names.
>
> Apply these amendments by editing the documents named, and nothing else:
>
> - **A2** (evidence_file table), **A3** (rounds), **A9** (project_funder), **A12** (cached risk score), **A15** (project_private_location) → `docs/03-DATABASE.md`
> - **A1** (ESCALATED state), **A3** (rounds), **A5** (DRAFT state), **A13** (reason ≥ 20 chars) → `docs/01-FEATURE-LOCK.md` §State machine
> - **A1** → `docs/04-AUTH.md` §4, including the escalation guard
> - **A2** changes the manifest shape → `docs/02-ARCHITECTURE.md` §4.4, and bump the schema string to `delta.manifest.v2`
> - **A12** → `docs/10-FORENSICS.md` §6
>
> Delete each amendment from `docs/16-AMENDMENTS-v2.md` as you land it.
>
> Write no code. Generate no migration. Install nothing. Paste a summary of every change you made, grouped by file. STOP.

**Read that diff yourself.** It is a documentation edit, so checking is cheap
and getting it wrong is expensive — every later stage reads these files.

Specifically confirm: `evidence_file` exists with a `role` enum and a `round`
column; `ESCALATED` is in the state table with a verifier-org-admin guard;
`project_private_location` holds the boundary and salt; the manifest says
`v2`.

```bash
git commit -m "docs(scope): fold schema and quorum amendments into the contract"
```

---

## Step 3 — Start both lanes

Now you can run them in parallel. Lane A does the foundation; Lane B builds
primitives that touch no data.

### Lane A — Claude Code (Opus 5.5)

Paste `AGENT_PROMPTS.md` **Prompt 0** (salvage and strip), then **Stage 1a**
(registry pre-flight). Prefix both with:

> You are **Lane A**. Read `docs/17-AGENT-LANES.md` §2 and write only to Lane A paths. Do not commit — report when ready and I will commit.

Stop at 1a and check the version table yourself. The four checks are listed
under that prompt: Drizzle `latest` must be 0.x, Next must be 16.x, nothing
deprecated, `postgres` present and `@neondatabase/serverless` absent.

### Lane B — Antigravity (Gemini 3.8 Flash high)

Paste this:

> Read `AGENTS.md`, then `docs/17-AGENT-LANES.md`, `docs/06-DESIGN-SYSTEM.md` and `docs/15-UI-STATES.md` completely. They override your training data.
>
> You are **Lane B — Presentation**. You may write only to the Lane B paths in §2 of the lanes document. You never run migrations, never install packages, never run `drizzle-kit`, and never edit anything under `src/server/`. You do not commit — report when ready.
>
> Build the primitive component library. Every component is a pure function of its props, ships with a fixture in a sibling `fixtures.ts`, and renders every state it supports:
>
> `HashDisplay` · `SeverityChip` · `VerificationBadge` · `StatusBadge` · `BitGrid` · `QuorumMeter` · `StepperProgress` · the `Skeleton` set from `docs/15-UI-STATES.md` §3 · `EmptyState` · `OfflineBanner`
>
> Also write the design tokens for both themes into `src/app/globals.css`, exactly as specified in `docs/06-DESIGN-SYSTEM.md` §2.
>
> Then add `src/app/(dev)/kitchen-sink/page.tsx` rendering every component in every state, side by side, so I can review without a database.
>
> Obey every prohibition in `docs/06-DESIGN-SYSTEM.md` §5. In particular: no glassmorphism, no `backdrop-filter`, no gradients, no glows, no shadows for elevation, no emoji, no shimmer. Depth comes from surface value shifts only.
>
> Report in the format in `docs/17-AGENT-LANES.md` §8. STOP.

**Check `FILES WRITTEN` in its report before anything else.** A path outside
Lane B means revert, not merge. Then open the kitchen sink page and look at
it — that is the whole point of building it.

---

## The order, condensed

```
1. Assemble docs, install hooks, commit                    you, by hand
2. Fold in schema amendments, read the diff, commit        Opus
3a. Lane A: Prompt 0 → Stage 1a → check versions           Opus
3b. Lane B: primitive library → kitchen sink               Antigravity
4. Commit each lane separately
5. Lane A: 1b → 1c → 1d spike → 1e, gating at each
6. From Stage 3, both lanes run on the table in §4 of the lanes doc
```

Do not let either agent run two stages in one go. The first checkpoint is
where a wrong version or a bad column type gets caught for free.

---

## Open items

Nothing. The quorum decision is closed by amendment A1 — `ESCALATED`,
resolved by an admin inside an assigned verifier organisation. That stays
independent of the project owner, so the conflict-of-interest rule is intact.
