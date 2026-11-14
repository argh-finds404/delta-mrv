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

> **As built (2026-11-14): `admin` means an operator.** An account whose address is listed
> in `OPERATOR_EMAILS` (or, with `DEMO_MODE`, the seeded demo admin):
> `src/server/services/operators.ts`. An operator has no vote. A verifier organisation's own
> admin is not an operator and cannot open `/admin` or assign itself a project.
>
> A workspace page reached with an expired or invalid session cookie redirects to
> `/sign-in?next=<the page>`, as a missing cookie does: the proxy passes the path on
> (`x-delta-next`) and `requireSession` reads it.

---

## 1. Public — `src/app/(public)/` · theme Paper

| Route | Guard | Purpose |
|---|---|---|
| `/` | public | Landing. Problem, how it works, a real seeded proof, the "what this does not prove" block, CTA. |
| `/atlas` | public | Impact Atlas. **Fuzzed geometry only** when unauthenticated. Exact polygons appear when an authorised session is present. |
| `/p/[id]` | public | Project overview, reported impact, verification status, proof links, survival check-ups (X11), feed links. No session branch at all: area-level geometry, approved records only (A6). The workspace view is `/projects/[id]`, §3. |
| `/proof/[id]` | public | Proof dossier. The product's centrepiece. See §4. Printing is the print stylesheet of this page (S7). |
| `/proof/[id]/print` | public | **Not a separate address.** The print stylesheet on `/proof/[id]` is the print-optimised certificate. |
| `/verify` | public | Reverse lookup: a proof id, a transaction hash, or a dropped file hashed in the browser (A7). Also rechecks a saved proof file (`.delta-proof.json`, X5) in the browser: no upload, no database, the chain asked only of Delta's registry. |
| `/p/[id]/feed.xml` | public | The project's anchored records as Atom 1.0 (X10). Pull-only. |
| `/trust` | public | What is proved and not, every finding rule, measured precision and recall, threat model summary, how fuzzing works (A8; replaces `/about`). |

`/atlas` is deliberately public and deliberately shared between anonymous and
authenticated callers. The same component renders both; the **server** decides
which geometry it receives. There is no client-side "if logged in, show exact".

## 2. Auth — `src/app/(auth)/` · theme Field

| Route | Guard | Purpose |
|---|---|---|
| `/sign-in` | public | Email + password. |
| `/sign-up` | public | Creates user, then organisation with an `org_type`. Where email is configured (X6) the account waits for its emailed link, and the organisation is created on `/sign-up/finish`. |
| `/sign-up/finish` | session | Where the confirmation link lands: creates the organisation chosen at sign-up, once. |
| `/forgot-password` | public | Asks for a reset link; the answer never says whether an account exists. Says so plainly where email is not configured. |
| `/reset-password` | public, token | The new password, with the token from the emailed link; every other session is signed out. |
| `/demo` | public, `DEMO_MODE` only | One-click role switcher. Route does not exist when the flag is off. |

## 3. Workspace — `src/app/(workspace)/` · theme Field

| Route | Guard | Purpose |
|---|---|---|
| `/dashboard` | session | Role-aware home. Owner: project and submission status. Verifier: review queue depth. Funder: verified outcomes. |
| `/projects/new` | owner | Create project. Boundary drawn on a MapLibre canvas, not typed as coordinates. |
| `/projects/[id]` | owner \| verifier | The project in the workspace: exact boundary, every submission and its state (A6). |
| `/projects/[id]/manage` | owner | Edit the description; the name, the claim and the tolerance until evidence has been sent, after which they are fixed. Close the project. Shows which organisations review it, and lets an owner or admin ask once for a reviewer (an audit event; an operator then assigns one). Sets the survival check-up interval (X11): set or shortened, never lengthened or removed once a record is approved. |
| `/projects/[id]/submit` | owner | Evidence intake. Before/after pair, previews, client-side hashing, offline queue, the framing check. `?checkup=<record>`: a survival check-up, one photo framed against the approved record's own. See §5. |
| `/submissions/[id]` | owner \| verifier | Full submission detail: decisions and reasons, evidence and hashes, findings, EXIF, map, audit trail, anchor. A linked funder gets a 404 here and reads `/proof/[id]`. |
| `/lab` | verifier | **The reviewer workspace.** See §3.1. `/lab?s=<submission id>` opens one record. |
| `/lab/[submissionId]` | verifier | **Not a separate address.** `/lab?s=<submission id>` and `/submissions/[id]` cover it. |
| `/admin` | admin (operator) | "Operations": anchor now, assigning a verifier organisation to each project with no reviewer (requests first), the job queue with "Retry stopped jobs", matchRef resolution (trace a reference, record "confirmed" or "cleared" with a reason, an audit event on the flagged side's chain), audit chain verification, the tamper demo. Organisation membership is the "People" panel on `/dashboard`. |
| `/admin/tamper-demo` | admin, `DEMO_MODE` only | **Not a separate address.** The demo is a panel on `/admin`; it changes one event in a copy of a real chain and shows verification failing there. |

`/dashboard?invite=<invitation id>` is the far end of an invitation link (A14): the page shows
the invitation to the account it was made for, and that account joins from there.

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
| `/api/v1/projects/[id]/feed` | public | The project's anchored records as JSON Feed 1.1 (X10). Pull-only; S10 webhooks stay cut. |
| `/api/v1/batches` | public | The newest confirmed anchor batches |
| `/api/v1/batches/[id]` | public | One confirmed batch and every leaf (record id, manifest fingerprint, approval time), enough to rebuild its root and keep a mirror |
| `/api/v1/stats` | api key | Aggregate counts for the key's organisation: its funded projects, their approved and anchored records |
| `/api/v1/proofs/lookup` | public | `/verify`'s lookup (A7): a proof id, a file's SHA-256 or a transaction hash, matched against public proofs only |
| `/api/submissions` | session, owner | `POST`: start a draft submission: `{ projectId }` for a before/after pair, `{ checkupOf }` for a survival check-up of an approved record (X11), which then takes one AFTER photo |
| `/api/submissions/[id]/upload-token` | session, owner | `POST`: a token for one direct upload to private storage |
| `/api/submissions/[id]/finalize` | session, owner | `POST`: draft to pending forensics, in one transaction. Takes an optional device signature (X2), checked against the stored bytes, never required |
| `/api/submissions/[id]/supplement` | session, owner | `POST`: one more photo after a request for more proof |
| `/api/submissions/[id]/findings` | session | `GET`: the findings, visible exactly when the submission is |
| `/api/submissions/[id]/decisions` | session | `GET`: review decisions, an open round's hidden until the caller has voted (A4) |
| `/api/evidence/[fileId]` | session | `GET`: streams one original, visible exactly when its submission is; never public |
| `/api/lab/queue` | session | `GET`: the caller's review queue; `?s=<id>` brings one record into the page |
| `/api/lab/decision` | session, verifier | `POST`: one decision with its written reason |
| `/api/internal/jobs/drain` | `CRON_SECRET` | Hourly queue drain |
| `/api/internal/anchor/daily` | `CRON_SECRET` | Daily batch + anchor. `?before=<ISO time>` closes the batch at that moment |
| `/api/dev/storage` | upload token; development only | Takes a browser upload when the server keeps evidence on its own disk (`LOCAL_STORAGE_DIR`). 404 in a production build and wherever that is unset |

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
