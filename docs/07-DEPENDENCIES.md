# 07 — Dependencies and Toolchain

Authority over: what may be installed, how, and what may never be.

---

## 1. The pinning contract

Before installing anything:

1. Resolve it live from the registry:
   `pnpm view <pkg> version dist-tags deprecated time.modified`
2. Confirm it is not deprecated and not a pre-release.
3. Install exact: `pnpm add -E <pkg>@<version>`
4. Append a row to `docs/DEPENDENCY_LOG.md` with the date, version, and why.

No carets. No tildes. No `latest`. A lockfile is not a substitute for an
exact range — a caret in `package.json` is an unreviewed future upgrade.

**Never install a package because a tutorial, a blog post or your own recall
says it is the right one.** Check the registry. Several packages in this
stack moved recently.

## 2. Toolchain

| | |
|---|---|
| Node | `>=22`. Pin in `.nvmrc` and `package.json#engines` |
| Package manager | `pnpm 11.x` via `corepack enable && corepack use pnpm@11` |
| Local DB | `docker/db.Dockerfile` — PostGIS 17 + pgvector in one image |
| Contracts | Foundry (`forge`, `cast`), OpenZeppelin v5, `solc >= 0.8.24` |
| Load testing | `k6` binary or `grafana/k6` container |

Supply-chain quarantine in `pnpm-workspace.yaml`:

```yaml
minimumReleaseAge: 10080   # 7 days — nothing published this week
allowBuilds:
  sharp: true
```

**pnpm fallback:** if the deployment platform cannot build with pnpm 11, drop
to pnpm 10 — but record it in `docs/DEPENDENCY_LOG.md` with the error. Do not
silently switch package managers, and never generate a `package-lock.json`.

## 3. Approved dependencies

| Domain | Packages | Rule |
|---|---|---|
| Framework | `next` 16.x, `react` 19.x, `react-dom` 19.x | App Router. `proxy.ts`, never `middleware.ts`. Async `params`/`searchParams`/`cookies()`/`headers()`. `after()` for post-response work. |
| Styling & UI | `tailwindcss` v4, `@tailwindcss/postcss`, `lucide-react`, `clsx`, `tailwind-merge` | Tokens from `docs/06-DESIGN-SYSTEM.md`. Fonts via `next/font/google`. `clsx` and `tailwind-merge` back the `cn()` helper in `src/lib/utils.ts`. `class-variance-authority` is added only when a component uses `cva`. |
| ORM | `drizzle-orm` stable `0.x`, `drizzle-kit` `0.x` | `relations()`, never `defineRelations()` (1.x API). |
| Driver | **`postgres` (postgres.js)** | TCP. Pooled URL at runtime with `prepare: false`; unpooled for migrations. |
| Auth | `better-auth` stable `1.x` | `organization` plugin, Drizzle adapter, `nextCookies()` last. CLI `generate` only. |
| Validation | `zod`, `server-only` | Hand-written Zod DTOs, kept separate from the DB schema. |
| Cartography | `maplibre-gl` `^5` | Client component only. Import its CSS. Keyless vector tiles. |
| Forensics | `exifr`, `sharp`, `@contentauth/c2pa-wasm` | Node runtime only (`serverExternalPackages`). |
| AI | `@google/genai` | Model name from `GEMINI_MODEL`, never hardcoded. |
| Storage | `@vercel/blob` | Private store behind `StoragePort`. |
| Crypto / chain | `viem`, `@openzeppelin/merkle-tree`, `canonicalize` | |
| Testing | `vitest`, `@playwright/test`, `tsx` | |
| Build-time | `typescript`, `eslint`, `eslint-config-next`, `@types/node`, `@types/react`, `@types/react-dom` | Required by `pnpm check` (`eslint .`, `tsc --noEmit`). Dev dependencies. |

## 4. Forbidden packages

Enforced by `scripts/check-forbidden-deps.mjs`, which runs in `pnpm check`
and in CI. Installing any of these fails the build.

| Package | Why |
|---|---|
| `@google/generative-ai` | Previous-generation SDK. Superseded by `@google/genai`. |
| `@neondatabase/serverless` | HTTP driver. **Throws on `transaction()`.** Kills the audit chain, the job queue and atomic state transitions. |
| `pg` | Use `postgres.js`. |
| `prisma`, `@prisma/*` | Drizzle is the ORM. See `ADR-0003`. |
| `drizzle-orm@1.x`, `@beta`, `@rc` | Different relations API. |
| `drizzle-zod` | DTOs are hand-written and decoupled from the schema. |
| `next-auth`, `@auth/*` | Better Auth is the auth layer. See `ADR-0004`. |
| `ethers`, `web3`, `wagmi`, `@rainbow-me/*` | `viem` only. No wallet connection exists in this product. |
| `hardhat` | Foundry only. |
| `cloudinary`, `aws-sdk`, `@aws-sdk/*` | Storage goes through `StoragePort`. |
| `axios` | Native `fetch`. |
| `moment` | `date-fns`. |
| `lodash` | Standard library. |

### Forbidden files

| File | Instead |
|---|---|
| `middleware.ts` | `src/proxy.ts` |
| `package-lock.json`, `yarn.lock` | `pnpm-lock.yaml` only |
| `.env` committed | `.env.example` only; real values never in git |

### Forbidden patterns

- Writing uploaded files to the local filesystem (`public/uploads/`,
  `fs.writeFile`). Serverless filesystems are ephemeral and `public/` is
  served from the build output — runtime writes are lost and never served.
- A `risk_score` that breaks any of the four cache conditions
  (`docs/10-FORENSICS.md` §6). The cached columns `risk_score`, `risk_band`
  and `scoring_version` on `evidence_submission` are allowed only when:
  (1) they are written solely by the pure function in `src/lib/scoring/` —
  never by hand, by the AI or by an admin; (2) `scoring_version` is stored
  with them, so a weights change does not rewrite history; (3) they are never
  rendered without their findings beside them; (4) they never gate a
  transition.
- `JSON.stringify` on anything that gets hashed. Use `canonicalize`.
- Any secret reachable from a client bundle. Only `NEXT_PUBLIC_*` crosses.

## 5. Environment variables

`src/env.ts` validates every variable with Zod at startup and **fails loudly**
if one is missing. No silent placeholder fallbacks — a dummy connection
string that lets the build pass hides the real failure until production.

```
DATABASE_URL              pooled, runtime
DATABASE_URL_UNPOOLED     migrations
BETTER_AUTH_SECRET
BETTER_AUTH_URL
BLOB_READ_WRITE_TOKEN
GEMINI_API_KEY            optional — absence degrades to ai_unavailable
GEMINI_MODEL              e.g. the current free-tier Flash model
BASE_SEPOLIA_RPC_URL
ANCHOR_PRIVATE_KEY        server only. NEVER NEXT_PUBLIC_
ANCHOR_CONTRACT_ADDRESS
NEXT_PUBLIC_CHAIN_ID      84532
NEXT_PUBLIC_CONTRACT_ADDRESS
CRON_SECRET
DEMO_MODE                 true | unset
```

Only `NEXT_PUBLIC_CHAIN_ID` and `NEXT_PUBLIC_CONTRACT_ADDRESS` are public —
both are already public facts on chain.

## 6. Cost ceiling

**Target operating cost: $0/month. No credit card.**

| Service | Free allowance | Guard |
|---|---|---|
| Hosting + functions | Hobby tier | Hobby cannot be billed. Daily cron only. |
| Postgres | Free tier, suspends when idle | Small pool. `after()` instead of polling. k6 never runs against it. |
| Blob storage | 1 GB storage, 10 GB transfer/month | 5 MB cap per file. Seed reuses a small image pool for 5k rows. |
| Gemini | Free tier covers Flash / Flash-Lite, no card | Degrade gracefully on quota. |
| Base Sepolia | Testnet, faucet gas | One batch per day. |
| CI | GitHub Actions free minutes | Hourly drain is a short curl. |

If a feature cannot be built inside these limits, it is cut, not paid for.

## 7. `pnpm check`

```json
"check": "eslint . && tsc --noEmit && vitest run && node scripts/check-forbidden-deps.mjs"
```

Green `pnpm check` is the definition of done for every unit of work. Never
weaken a rule to make it pass.
