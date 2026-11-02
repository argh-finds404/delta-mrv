# Dependency Log

Append-only. One row per package, added at install time.

**Before installing anything:**

```bash
pnpm view <pkg> version dist-tags deprecated time.modified
pnpm add -E <pkg>@<version>
```

Then add the row below. A package in `package.json` without a row here is a
`pnpm check` failure waiting to be written.

---

| Date | Package | Version | Deprecated? | Verified by | Why |
|---|---|---|---|---|---|
| | | | | | |

---

## Toolchain decisions

| Date | Decision | Reason |
|---|---|---|
| | Node version | |
| | pnpm version | |
| | `GEMINI_MODEL` value | Current free-tier Flash model as resolved at setup |
| | Postgres / PostGIS / pgvector image tags | |
| | Foundry + OpenZeppelin versions | |

## Deviations

Record anything that departs from `docs/07-DEPENDENCIES.md`, with the error
that forced it.

| Date | Deviation | Error that forced it | Revisit when |
|---|---|---|---|
| | | | |
