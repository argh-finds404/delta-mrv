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
| 2026-11-02 | `next` | 16.4.3 | No | registry check 2026-11-02 | Framework. 16.4.4 deferred, published inside the 7-day quarantine |
| 2026-11-02 | `react` | 19.3.1 | No | registry check 2026-11-02 | UI runtime |
| 2026-11-02 | `react-dom` | 19.3.1 | No | registry check 2026-11-02 | UI runtime |
| 2026-11-02 | `tailwindcss` | 4.3.3 | No | registry check 2026-11-02 | Styling, v4 |
| 2026-11-02 | `@tailwindcss/postcss` | 4.3.3 | No | registry check 2026-11-02 | Tailwind v4 PostCSS plugin |
| 2026-11-02 | `lucide-react` | 1.61.0 | No | registry check 2026-11-02 | Icons. 1.66.0 deferred, 2 days old |
| 2026-11-02 | `drizzle-orm` | 0.45.4 | No | registry check 2026-11-02 | ORM, stable 0.x. 1.x is on beta/rc tags only |
| 2026-11-02 | `postgres` | 3.4.9 | No | registry check 2026-11-02 | postgres.js TCP driver. 4.0.0 not adopted, see Deviations |
| 2026-11-02 | `better-auth` | 1.7.13 | No | registry check 2026-11-02 | Auth, 1.x. 1.7.15 deferred, 1 day old |
| 2026-11-02 | `zod` | 4.6.7 | No | registry check 2026-11-02 | Validation |
| 2026-11-02 | `server-only` | 0.0.1 | No | registry check 2026-11-02 | Marks server modules |
| 2026-11-02 | `maplibre-gl` | 5.24.0 | No | registry check 2026-11-02 | Atlas map. Held on v5, see Deviations |
| 2026-11-02 | `exifr` | 7.1.3 | No | registry check 2026-11-02 | EXIF extraction |
| 2026-11-02 | `sharp` | 0.35.5 | No | registry check 2026-11-02 | dHash and image handling. Only package allowed to run build scripts |
| 2026-11-02 | `@google/genai` | 2.31.0 | No | registry check 2026-11-02 | Gemini advisory audit. 2.32.0 deferred, 4 days old |
| 2026-11-02 | `@vercel/blob` | 2.8.2 | No | registry check 2026-11-02 | Private evidence storage behind StoragePort |
| 2026-11-02 | `viem` | 2.57.11 | No | registry check 2026-11-02 | Chain reads and anchor writes. 2.57.14 deferred, 1 day old |
| 2026-11-02 | `@openzeppelin/merkle-tree` | 1.0.8 | No | registry check 2026-11-02 | StandardMerkleTree batches |
| 2026-11-02 | `canonicalize` | 5.1.0 | No | registry check 2026-11-02 | RFC 8785 serialisation |
| 2026-11-02 | `clsx` | 2.1.1 | No | registry check 2026-11-02 | `cn()` helper in src/lib/utils.ts (Lane B). Omitted from the §3 table by oversight, approved by maintainer |
| 2026-11-02 | `tailwind-merge` | 3.7.0 | No | registry check 2026-11-02 | `cn()` helper in src/lib/utils.ts (Lane B). Same approval |
| 2026-11-02 | `drizzle-kit` | 0.31.11 | No | registry check 2026-11-02 | Migration generator, stable 0.x. In the §3 table but missed in the first install; added with the schema (dev) |
| 2026-11-02 | `vitest` | 5.0.5 | No | registry check 2026-11-02 | Unit and integration tests (dev) |
| 2026-11-02 | `@playwright/test` | 1.64.1 | No | registry check 2026-11-02 | End-to-end tests (dev) |
| 2026-11-02 | `tsx` | 4.23.15 | No | registry check 2026-11-02 | Run TypeScript scripts (dev) |
| 2026-11-02 | `typescript` | 5.9.3 | No | registry check 2026-11-02 | Implied by `tsc --noEmit` in pnpm check (dev). Approved retroactively. 7.0.2 not adopted |
| 2026-11-02 | `eslint` | 10.13.0 | No | registry check 2026-11-02 | Implied by `eslint .` in pnpm check (dev). Approved retroactively |
| 2026-11-02 | `eslint-config-next` | 16.4.3 | No | registry check 2026-11-02 | Next lint rules, matches next (dev). Build-time row in docs/07 §3 |
| 2026-11-02 | `@types/node` | 24.19.2 | No | registry check 2026-11-02 | Node 24 types (dev). Build-time row in docs/07 §3 |
| 2026-11-02 | `@types/react` | 19.3.0 | No | registry check 2026-11-02 | React types (dev). Build-time row in docs/07 §3 |
| 2026-11-02 | `@types/react-dom` | 19.3.0 | No | registry check 2026-11-02 | React DOM types (dev). Build-time row in docs/07 §3 |
| 2026-11-14 | `@contentauth/c2pa-wasm` | 0.14.0 | No | registry check 2026-11-14 (`0.14.0` published 2026-11-04; `0.15.0` published 2026-11-11 inside the 7-day `minimumReleaseAge`) | C2PA Content Credentials JUMBF reader (X9, `c2pa.v1`). MIT licence, no install scripts, loaded via `initSync` and `WasmReader.fromBytes` in Node |

---

## Toolchain decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-11-02 | Node `>=22` in `package.json#engines`; `.nvmrc` is `24` | Floor from docs/07 §2. `.nvmrc` matches the Node 24.22.1 these pins were resolved and tested on | |
| 2026-11-02 | pnpm `11.28.10` (`corepack use pnpm@11`) | Resolved by corepack and written to `packageManager`. Published 2026-10-30, so inside the 7-day window that §2 applies to packages. `corepack enable` needs admin on this Windows install, so it was run with `--install-directory C:/Users/orgho/.local/bin`. pnpm 10 fallback pre-approved for Vercel, nothing used yet | |
| | `GEMINI_MODEL` value | Current free-tier Flash model as resolved at setup |
| 2026-11-02 | Postgres / PostGIS / pgvector image: `postgis/postgis:18-3.6` plus apt `postgresql-18-pgvector` | Parity with the Neon dev branch (PostgreSQL 18.6, PostGIS 3.6.4, pgvector 0.8.6). Tag verified on Docker Hub (Debian trixie, linux/amd64 only); `postgresql-18-pgvector` 0.8.7 exists for Debian 13 on PGDG. Replaces the 17-3.5 pin. **Built and run 2026-11-03.** The first build exposed a mistake: the install line still said `postgresql-17-pgvector`, which built without error but installed pgvector under the PG 17 directories (and pulled in a PG 17 server), so `CREATE EXTENSION vector` could not have worked. Fixed to `postgresql-18-pgvector`. Verified: PostgreSQL 18.6, PostGIS 3.6.4, pgvector 0.8.7, all five migrations apply, 74/74 integration tests pass, and data survives removing and recreating the container (volume `/var/lib/postgresql`, PG 18 layout). Local differs from Neon only in pgvector 0.8.7 vs 0.8.6 and three extra extensions the image ships (`postgis_topology`, `postgis_tiger_geocoder`, `fuzzystrmatch`) |
| 2026-11-13 | Foundry `1.5.1-stable` (forge, cast, anvil; commit `b0a9dd9`), from the `stable` release archive on GitHub, unpacked to `~/.foundry/bin` | Not on npm. `forge --version` checked after install. Not on the Git Bash PATH on this machine: scripts look in `~/.foundry/bin` first |
| 2026-11-13 | `forge-std` `v1.16.2` and `openzeppelin-contracts` `v5.6.1`, as git submodules under `contracts/lib/` (`forge install`) | Tags verified with `git ls-remote`. OpenZeppelin `v5.6.1` is what npm calls `latest`; the newer `v5.7.0` tag was left alone. `forge-std` on npm is an unrelated package, so neither library comes from npm. `solc` `0.8.28`, `evm_version = "cancun"`, pinned in `contracts/foundry.toml` |
| 2026-11-13 | Playwright Chromium, by `pnpm exec playwright install chromium` (for `@playwright/test` 1.64.1, already pinned) | A browser download, not a package: needed to run `pnpm test:e2e` |

## Deviations

Record anything that departs from `docs/07-DEPENDENCIES.md`, with the error
that forced it.

| Date | Deviation | Error that forced it | Revisit when |
|---|---|---|---|
| 2026-11-02 | `maplibre-gl` 5.24.0, not 6.16.0 | docs/07 §3 says `^5` and the docs assume v5; v6's API is unverified | Deliberate deferral. Revisit when the Atlas is built and v6 is checked |
| 2026-11-02 | `postgres` 3.4.9, not 4.0.0 | 4.0.0 is a new major, 4 days old, for the driver the whole integrity model depends on | Revisit after Stage 2, once 4.x has had time and the spike tests can run against it |
| 2026-11-02 | Seven pins sit behind `latest`: next, shadcn, lucide-react, better-auth, viem, @google/genai, postgres | Each `latest` was published inside the 7-day `minimumReleaseAge` | Approved. Move to newer pins once past quarantine |
| 2026-11-02 | `typescript`, `eslint`, `eslint-config-next`, `@types/node`, `@types/react`, `@types/react-dom` installed though absent from docs/07 §3 | `pnpm check` runs `eslint .` and `tsc --noEmit`, so they are required. Installed without prior approval; approved retroactively, listed as the Build-time row in docs/07 §3 | Resolved |
| 2026-11-02 | `eslint` 10.13.0, not 9.39.5 | 9.39.5 is flagged deprecated by the registry ("no longer supported"), installed first then replaced. eslint-plugin-react, -import and -jsx-a11y do not declare ESLint 10 peer support | Revisit if lint fails. `pnpm peers check`: unmet peer `eslint` (installed 10.13.0) for `eslint-plugin-import@2.32.0` (wants up to ^9), `eslint-plugin-jsx-a11y@6.10.2` (up to ^9) and `eslint-plugin-react@7.37.5` (up to ^9.7), all pulled in by `eslint-config-next@16.4.3`. Lint ran clean on 10.13.0 |
| 2026-11-02 | `typescript` 5.9.3, not 7.0.2 | `latest` is a new major; compatibility with Next 16 and eslint-config-next unverified | Revisit when Next documents TS 7 |
| 2026-11-02 | `allowBuilds` also lists `@google/genai`, `esbuild`, `protobufjs`, `unrs-resolver` as `false` | pnpm 11 exits 1 with `ERR_PNPM_IGNORED_BUILDS` for any build script not listed, which breaks `pnpm install` and `pnpm check` | `false` means reviewed and not run; only `sharp` runs scripts |
| 2026-11-02 | `next.config.ts` dropped its `@tailwindcss/turbopack` loader rule | The package was never installed, and docs/07 §3 specifies `@tailwindcss/postcss` for Tailwind v4. `pnpm build` failed on the missing loader | Revisit if Tailwind v4 needs a Turbopack-specific loader |
| 2026-11-02 | Geography columns are created bare (`geography`) and given their typmod by hand-written migration `0002_geography_typmod` | drizzle-kit double-quotes any custom type it does not know, so `geography(Point, 4326)` was emitted as an invalid type name | Revisit if drizzle-kit learns geography or custom types stop being quoted |
| 2026-11-02 | Better Auth schema generated with `pnpm dlx auth@1.7.13 generate`, not installed in `package.json` | `@better-auth/cli` is deprecated on the registry ("Package no longer supported"); `auth` is its successor and `auth@1.7.13` depends on `better-auth` 1.7.13 exactly. Published 2026-10-25 (past the 7-day quarantine; 1.7.14 and 1.7.15 are not). One-off tool run with `BETTER_AUTH_TELEMETRY=0`, output written outside the repo. The CLI cannot load a config that reaches `server-only` (it overrides jiti's alias and ignores the `react-server` condition; both tried), so the run used a throwaway copy of `src/server/auth/index.ts` generated by script with `server-only`, `env` and the db client replaced by inert stand-ins, deleted afterwards | Rerun the same way whenever the auth options change. Revisit if the CLI gains a way to stub `server-only` |
| 2026-11-03 | `src/env.ts` requires five variables at boot (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_CHAIN_ID`); eight are checked at the point of use by `requireEnv(name)` | docs/07-DEPENDENCIES.md §5 says every variable is validated at boot. Eight belong to Stages 3 to 6 and blocked `pnpm dev` before those stages exist. Maintainer decision. `requireEnv` throws naming the variable and the stage, never the value. The deferred secrets are not on the `env` object | Revisit at Stage 6, when all eight are in use; docs/07 §5 should then be reworded |
| 2026-11-03 | `scripts/seed.ts` writes with plain SQL, not the services | ESLint forbids `scripts/` importing `src/server` (which imports `server-only`). Fuzzing moved to `src/lib/geo/fuzz.ts` and the location commitment is `src/lib/crypto/location.ts`, so seed and service share one implementation of both; the rest (project insert shape) is duplicated | Revisit if `scripts/lib/db.ts` (docs/02 §2) gets a shared project-creation helper |
| 2026-11-02 | `test:integration` sets `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000`, which needs `shellEmulator: true` in `pnpm-workspace.yaml` | Node 24 gives each resolved address 250 ms to accept a TCP connection. From this machine to Neon `us-east-2` that is too short: `connect ETIMEDOUT` / `CONNECT_TIMEOUT` on roughly every other run, with the host reachable. A plain `node --flag vitest` does not help (vitest workers are separate processes that do not inherit it; verified, they still report 250), only `NODE_OPTIONS` does, and `VAR=x cmd` fails in Windows `cmd` unless pnpm's shell emulator is on. `db:migrate` and `db:check-typmod` hit the same limit and are not patched; export the variable by hand for them | Drop it when the link to Neon no longer needs it, or when Node's default changes. `shellEmulator` applies to every script; `pnpm check` was re-run with it on |
