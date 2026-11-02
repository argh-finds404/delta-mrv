# Where these files go

Copy the contents of this folder to the root of the `delta-mrv` repository.
The result:

```
delta-mrv/
├── CLAUDE.md                 ← repo root. Claude Code reads this automatically
├── AGENTS.md                 ← repo root. Pointer for non-Claude agents
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
    ├── THREAT_MODEL.md
    ├── DEPENDENCY_LOG.md
    └── adr/
        ├── ADR-0001-custom-registry-vs-eas.md
        ├── ADR-0002-base-sepolia-vs-signed-log.md
        ├── ADR-0003-drizzle-vs-prisma.md
        ├── ADR-0004-better-auth-vs-authjs.md
        └── ADR-0005-merkle-leaf-and-manifest-layout.md
```

## Why root and not `.claude/`

Claude Code reads `CLAUDE.md` at the repository root at the start of every
session, so the index is always in context. `docs/` files are read on demand
when the work touches their domain — which is why `CLAUDE.md` is short and
tells the agent which file to open.

Do not move `CLAUDE.md` into `docs/`. Do not rename the numbered files; the
numbers are the reading order and are referenced by path across the set.

## First commands in Claude Code

```bash
git config user.name  "Shoumik Orgho"
git config user.email "orghodutta@gmail.com"
git checkout -b rebuild/foundation
```

Then, in Claude Code:

> Read CLAUDE.md, docs/12-AGENT-SCOPE.md and docs/11-IMPLEMENTATION.md.
> Confirm the git author config matches the maintainer. Then begin Stage 1,
> and stop at the Stage 1 gate.

## Still to supply

These are referenced by the set but are written during the build:

| File | Written at |
|---|---|
| `README.md` | Stage 8, from `docs/00-PRODUCT.md` + real measured numbers |
| `docs/FORENSIC_EVAL.md` | Stage 8, by `scripts/eval-forensics.ts` |
| `.env.example` | Stage 1, from the variable list in `docs/07-DEPENDENCIES.md` |

## Changing a decision

These documents are the contract. If a decision needs to change, edit the
document first and commit that change on its own, then implement against it.
A codebase that has drifted from its own specification is worse than one with
no specification, because the agent will follow the stale document.
