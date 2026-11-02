# 05 — Routes

Authority over: every route, its guard, its data source, its theme.

**Rule:** no route exists that is not listed here. Adding one requires a
maintainer decision and an entry in this file.

---

## Legend

| Guard | Meaning |
|---|---|
| `public` | No session required |
| `session` | Any authenticated user |
| `owner` | Member of an `OWNER` org that owns the resource |
| `verifier` | Member of an assigned `VERIFIER` org |
| `funder` | Member of a `FUNDER` org |
| `admin` | Platform admin |

Theme: **Field** = dark workspace. **Paper** = warm public certificate.
See `docs/06-DESIGN-SYSTEM.md`.

---

## 1. Public — `src/app/(public)/` · theme Paper

| Route | Guard | Purpose |
|---|---|---|
| `/` | public | Landing. Problem, how it works, a real seeded proof, the "what this does not prove" block, CTA. |
| `/atlas` | public | Impact Atlas. **Fuzzed geometry only** when unauthenticated. Exact polygons appear when an authorised session is present. |
| `/projects/[id]` | public | Project overview, reported impact, evidence timeline, verification status, proof links. Sensitive fields filtered by caller. |
| `/proof/[id]` | public | Proof dossier. The product's centrepiece. See §4. |
| `/proof/[id]/print` | public | Print-optimised certificate. |
| `/about` | public | Threat model summary, limitations, technology, open source links. |

`/atlas` is deliberately public and deliberately shared between anonymous and
authenticated callers. The same component renders both; the **server** decides
which geometry it receives. There is no client-side "if logged in, show exact".

## 2. Auth — `src/app/(auth)/` · theme Field

| Route | Guard | Purpose |
|---|---|---|
| `/sign-in` | public | Email + password. |
| `/sign-up` | public | Creates user, then organisation with an `org_type`. |
| `/demo` | public, `DEMO_MODE` only | One-click role switcher. Route does not exist when the flag is off. |

## 3. Workspace — `src/app/(workspace)/` · theme Field

| Route | Guard | Purpose |
|---|---|---|
| `/dashboard` | session | Role-aware home. Owner: project and submission status. Verifier: review queue depth. Funder: verified outcomes. |
| `/projects/new` | owner | Create project. Boundary drawn on a MapLibre canvas, not typed as coordinates. |
| `/projects/[id]/manage` | owner | Edit metadata, manage verifier assignments (request only — admin assigns). |
| `/projects/[id]/submit` | owner | Evidence intake. Before/after pair, previews, client-side hashing, offline queue. See §5. |
| `/submissions/[id]` | owner \| verifier | Full submission detail: findings, EXIF, map, hashes, decision history. |
| `/lab` | verifier | **The reviewer workspace.** See §3.1. |
| `/lab/[submissionId]` | verifier | Single-submission deep inspection. |
| `/admin` | admin | Queue health, retry stuck jobs, anchor now, verifier assignment, org management, audit chain verification. |
| `/admin/tamper-demo` | admin, `DEMO_MODE` only | Breaks one sandbox audit row and shows verification failing. |

### 3.1 `/lab` — the queue

The verifier's primary surface. Design for someone reviewing a hundred
submissions, not three.

- **Keyboard-first.** `j`/`k` move, `Enter` opens, `a` approve, `r` reject,
  `m` request more proof, `?` shortcut sheet. Every shortcut has a visible
  button. Never keyboard-only.
- Queue shows only submissions the caller's org is assigned to and did not
  originate.
- A decision requires a written reason of at least 20 characters. The
  approve button is disabled until the reason meets the minimum.
- After a decision, advance to the next item automatically and show an undo
  window of a few seconds **before** the write commits. Once written, a
  decision is permanent — there is no edit.
- Severity ordering: `HIGH` findings sort to the top of the queue.

## 4. `/proof/[id]` — the proof dossier

The route a stranger lands on. It must work with no session, no JavaScript
for the static content, and progressive enhancement for verification.

Sections, in order:

1. **Header** — project, owner org, verifier org, activity type, reported impact
2. **Verification state** — one of `MATCH`, `MISMATCH`, `PENDING`, `UNAVAILABLE`,
   computed in the browser, never asserted by the server
3. **Evidence** — before/after images, SHA-256 of each shown in full
4. **Drop the original photo** — drag a file in, `crypto.subtle` hashes it
   locally, compares to the manifest. The file never leaves the browser; say
   so on the page
5. **Decision record** — each reviewer decision with its written reason and
   timestamp
6. **Location** — fuzzed map plus the salted commitment. Signed-in authorised
   users additionally see the exact polygon and can verify the commitment
7. **Chain anchor** — chain id, contract address, transaction hash linking to
   BaseScan, block number, Merkle root, leaf index and proof path
8. **What this does not prove** — verbatim from `docs/00-PRODUCT.md`

### Verification result semantics

| Result | Meaning | Never confuse with |
|---|---|---|
| `MATCH` | Recomputed manifest hash is in the anchored Merkle tree | "the claim is true" |
| `MISMATCH` | Record differs from what was anchored | |
| `PENDING` | Approved, batch not yet confirmed on chain | `MISMATCH` |
| `UNAVAILABLE` | RPC unreachable | `MISMATCH` |

An unreachable RPC showing red would be a lie. `UNAVAILABLE` is neutral grey.

## 5. `/projects/[id]/submit` — intake

- Before/after pair in one submission. Both required.
- Client-side: compute SHA-256 with `crypto.subtle` at selection time, show
  it, send it as `client_sha256`. Labelled in the UI as an unverified
  convenience value — the server recomputes from stored bytes and that is
  authoritative.
- Offline: if the network is down, queue the submission in IndexedDB with its
  client hash and show a clear "queued, will send when online" state. Sync on
  reconnect. Never silently drop.
- 5 MB cap, `jpeg`/`png`/`webp`/`heic`, MIME sniffed from bytes not from the
  filename extension.
- Optional note field. Optional browser geolocation, always labelled a weak
  signal.
- Never strip or rewrite EXIF on the stored original.

## 6. API — `src/app/api/`

| Route | Guard | Purpose |
|---|---|---|
| `/api/auth/[...all]` | — | Better Auth handler |
| `/api/v1/projects` | api key | List projects. Fuzzed geometry. Paginated. |
| `/api/v1/projects/[id]` | api key | Project detail |
| `/api/v1/submissions/[id]/proof` | public | Canonical manifest + Merkle proof. Powers third-party verification. |
| `/api/v1/stats` | api key | Aggregate counts |
| `/api/internal/jobs/drain` | `CRON_SECRET` | Hourly queue drain |
| `/api/internal/anchor/daily` | `CRON_SECRET` | Daily batch + anchor |
| `/api/webhooks/test` | api key | Signed delivery test |

All `/api/v1` handlers are thin adapters: Zod parse → one service call →
response shape. No database access, no business rules.

`/api/v1/submissions/[id]/proof` is public and unauthenticated by design —
independent verification is the point. It returns fuzzed geometry and the
commitment, never the salt.

## 7. Route-level rules

- `export const runtime = "nodejs"` on every route touching `sharp`, `exifr`,
  `node:crypto` or the database. Never the edge runtime.
- Server Components by default. `"use client"` only where interaction
  genuinely requires it: the map canvas, the uploader, the drop-photo
  verifier, the keyboard queue.
- `params` and `searchParams` are async in Next 16. Await them.
- Every dynamic route handles not-found explicitly. No crash pages.
- Loading states are real skeletons matching the final layout, not spinners.
