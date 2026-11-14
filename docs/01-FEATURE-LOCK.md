# 01 — Feature Lock v2.0

Authority over: what may be built.

**Rule:** if a capability is not listed below as MUST, SHOULD or STRETCH, it
is out of scope. Do not build it, do not scaffold it, do not add a
"placeholder for later". Propose it to the maintainer and wait.

---

## MUST — the product does not exist without these

| # | Feature | Specification |
|---|---|---|
| M1 | **Three tenant types** | `OWNER`, `VERIFIER`, `FUNDER` as an `org_type` on the organisation. Verifiers reach projects only through explicit `project_assignment` rows. |
| M2 | **Conflict-of-interest rule** | A reviewer's organisation must differ from the project's owner organisation. Enforced in the service layer, never in the UI alone. Dedicated test suite. No admin override exists. |
| M3 | **Better Auth + organization plugin** | Real sessions. `session.activeOrganizationId` is UI context only; every service call re-verifies membership server-side. |
| M4 | **Impact Atlas** (`/atlas`) | MapLibre GL JS v5 client canvas over PostGIS polygons. Status filters, project drawer. |
| M5 | **Evidence intake + private storage** | Originals to `@vercel/blob` private store behind a `StoragePort` interface. 5 MB cap. `jpeg`, `png`, `webp`, `heic`. Originals never transformed. Never stored in Postgres. |
| M6 | **Postgres job queue** | `SELECT … FOR UPDATE SKIP LOCKED` with attempts, backoff, idempotency keys. Drained by Next.js `after()` on submit, an hourly GitHub Action safety net, and an admin "Retry stuck jobs" button. |
| M7 | **Forensic signals as findings** | SHA-256, 64-bit dHash, EXIF GPS vs polygon, before/after change delta. Each produces a `forensic_finding` row with severity and reason. See `docs/10-FORENSICS.md`. |
| M8 | **Submission state machine** | Explicit transition table in `src/lib/state-machine/`, enforced in services, unit-tested. See §State machine below. |
| M9 | **Evidence Lab** (`/lab`) | Side-by-side reviewer workspace. Every finding drills down to the inputs that produced it. Keyboard-driven queue. |
| M10 | **Hash-chained audit log** | Per-organisation chain, serialised with `pg_advisory_xact_lock`, RFC 8785 canonical JSON, domain-tagged. DB-enforced append-only. |
| M11 | **Merkle anchoring** | `@openzeppelin/merkle-tree` batches, `ImpactAnchorRegistry.sol` on Base Sepolia (84532), Foundry-tested. Daily cron + admin "Anchor now". |
| M12 | **Public proof dossier** (`/proof/[id]`) | Warm Paper certificate. Browser recomputes the manifest hash and verifies the Merkle proof via `viem`. Includes the drop-original-photo check. |
| M13 | **Server-side coordinate fuzzing** | Unauthenticated responses receive area-level geometry plus a salted location commitment. Exact geometry and salt only to authorised sessions. Leak-tested. |
| M14 | **Offline-first field capture (PWA)** | Capture → hash in-browser with `crypto.subtle` → queue in IndexedDB → sync when online. The client hash is recorded as an earliest-known-existence signal, explicitly labelled weak. |
| M15 | **Threat model + 5 ADRs** | `docs/THREAT_MODEL.md` and `docs/adr/ADR-0001` … `ADR-0005`. |

## SHOULD — build if the MUSTs are green

| # | Feature | Notes |
|---|---|---|
| S1 | **2-of-N reviewer quorum** | Two approvals from distinct verifier users. Cheap once M8 exists; it is the line between a workflow and governance. |
| S2 | **AI vision audit** | `@google/genai`, Zod-validated, advisory only, degrades to `ai_unavailable`. See `docs/08-AI.md`. |
| S3 | **Public API v1 + hashed API keys** | `/api/v1` thin adapters over services. |
| S4 | **Funder read-only portal** | |
| S5 | **Tamper demo** | `DEMO_MODE` only. Mutates one audit row in a sandbox org and shows chain verification failing at that exact sequence number. |
| S6 | **Deterministic replay** | Re-run forensics on a stored submission and assert byte-identical outputs. |
| S7 | **Printable proof certificate** | Print stylesheet on `/proof/[id]`. No dependencies. |
| S8 | **Labelled forensic eval set** | Precision/recall over resized, recompressed, cropped and cross-project duplicates → `docs/FORENSIC_EVAL.md`. |
| S9 | **5k+ seeded submissions + local k6** | Seed reuses a small image pool. k6 against local Docker Postgres only, never against the hosted free tier. |
| S10 | ~~Webhooks~~ | **Cut** (2026-11-14, maintainer decision), first in the cut order below. No schema, no route; alerts are in-app lists. |

## STRETCH — only after everything above ships

| # | Feature |
|---|---|
| X1 | Sentinel-2 NDVI cross-check, feature-flagged, graceful `inconclusive` — **built 2026-11-14**: free keyless Earth Search, `NDVI_ENABLED`, one `SATELLITE_NDVI` finding, always `INFO` |
| X2 | Passkey-signed capture hash / C2PA read — **built 2026-11-14 as a device-key signature**: a non-extractable WebCrypto P-256 key in the browser, checked at finalize and again on the proof page. Not WebAuthn, not hardware-backed, no C2PA read |
| X3 | Error level analysis lens in the Evidence Lab — **added by the maintainer 2026-11-14**: browser-only, toggled on the comparison, a reading aid that writes no finding |
| X4 | Boundary import from GeoJSON or KML on `/projects/new` — **added by the maintainer 2026-11-14, built**: parsed in the browser, one area per project, holes left out with a note, the area and the claim density shown before anything is sent |
| X5 | Offline proof file (`delta.proof-bundle.v1`) from `/proof/[id]`, rechecked on `/verify` — **added 2026-11-14, built**: manifest, Merkle path, contract and device signature; checked with no Delta server or database, the chain asked only of Delta's own registry |
| X6 | Email verification and password reset — **added 2026-11-14, built**: Better Auth's hooks over Resend's free tier, no SDK; off where no email is configured; where it is, an operator's address counts only once confirmed |
| X7 | Seasonal NDVI baseline (X1) — **added 2026-11-14, built**: the same season in up to four earlier years, its median and this season's distance from it; still one INFO finding |
| X8 | Evidence Lab queue windowing — **added 2026-11-14, built**: 40 rows at a time, more on scroll, keyboard or request; the selected row always drawn |
| X9 | C2PA Content Credentials read (X2) — **added 2026-11-14, not built**: needs `@contentauth/c2pa-wasm` (9 MB WebAssembly) added and run; waiting on the maintainer's approval of the package |
| X10 | Pull-only feeds — **added 2026-11-14, built**: a project's anchored records as JSON Feed and Atom, and every confirmed batch's leaves at `/api/v1/batches/[id]`, so a mirror can prove a removal. S10 push webhooks stay cut |
| X11 | Survival check-ups — **added 2026-11-14, built**: an approved record photographed again on a schedule the owner sets (shortened, never lengthened or removed once a record is approved), each visit reviewed like any submission; a missed visit reads "overdue"; the earlier photo is laid over today's to check the framing |
| X12 | Claim check (`claims.v1`) — **added 2026-11-14, built**: the claimed area against the drawn boundary, or plants per square metre against the densest planting methods; INFO when ordinary, MEDIUM when not, never a gate |

## CUT — never build these

- Carbon credit tokenisation, ERC-20, NFTs, any minting
- Donations, fundraising, payments, subscription billing
- DAO voting, decentralised dispute resolution
- Multi-chain deployment (Base Sepolia only)
- Native mobile applications (the PWA in M14 is the mobile story)
- Decentralised storage networks (IPFS, Arweave)
- AI object counting presented as authoritative ("AI counted 200 trees")
- Any automated approval path
- Government identity verification
- A dashboard tile, chart, or counter whose number is not computed from real data

---

## Cut order under time pressure

Cut in exactly this order. Never cut a MUST.

`S10 webhooks → S4 funder portal → S8 eval set → S6 replay → S1 quorum`

S10 was cut on 2026-11-14. Nothing else on this list has been.

---

## State machine

```
DRAFT
  └─► PENDING_FORENSICS            submissions.finalize
        └─► IN_REVIEW ──┬─► APPROVED ──► ANCHORED
                        ├─► REJECTED   (terminal)
                        ├─► ESCALATED ──┬─► APPROVED
                        │               └─► REJECTED
                        └─► NEEDS_MORE_PROOF ──► IN_REVIEW   (round + 1)
```

**Decision rules — settled, do not re-litigate:**

- `APPROVED` requires **2 approvals from distinct verifier users** in an
  assigned verifier organisation.
- **2 rejections from distinct verifier users → `REJECTED`, terminal.**
- **A split 1 approve / 1 reject → `ESCALATED`.** An escalated submission is
  resolved by a deciding vote from an `admin` **inside an assigned
  `VERIFIER` organisation**, to `APPROVED` or `REJECTED`. That person is
  independent of the project owner, passes the full `assertCanReview` gate,
  and their vote is attributable and hash-chained like any other. The voter
  must not have already voted in this round. A **platform** admin still
  cannot vote — an admin override at platform level would be a backdoor
  through M2. See `docs/04-AUTH.md` §4.
- Any reviewer may request more proof: `NEEDS_MORE_PROOF`.
- **Review rounds.** `evidence_submission.round` starts at 1 and
  `review_decision.round` records the round a decision belongs to. Unique
  `(submission_id, round, reviewer_user_id)` — one decision per reviewer per
  round. `NEEDS_MORE_PROOF` → owner adds a supplement → `round += 1` →
  `IN_REVIEW`. Prior decisions remain in the table and in the audit chain;
  they belong to an earlier round and do not count toward quorum. **Quorum is
  always evaluated over the current round only.** A reviewer who decided in
  round 1 may decide again in round 2.
- **Every decision requires a written reason of at least 20 characters**,
  enforced by Zod and by a database `CHECK` constraint. The UI may offer
  quick-insert phrases that the reviewer then edits.
- Only `APPROVED` submissions are eligible for a Merkle batch.
- `ANCHORED` is reached only after the transaction is confirmed on chain.

### Draft and direct upload

Evidence files do not pass through a Server Action: serverless body limits are
low and a dropped connection loses the whole request.

```
1. submissions.createDraft(actor, projectId) → submissionId     status DRAFT
2. Route handler issues a scoped client-upload token
     restricted to the allowed MIME types and 5 MB
3. Browser uploads each file directly to private blob storage
4. submissions.finalize(actor, submissionId)  — ONE transaction:
     verify every expected file exists and is within limits
     read bytes back, hash them server-side
     DRAFT → PENDING_FORENSICS
     insert job
     append audit event
```

`DRAFT` is the initial state. A draft older than 24 hours with no files is
swept by a job.

**The authority rule is unchanged:** the server reads the bytes back out of
storage and hashes those. A client-supplied hash is never authoritative, and
the upload token's content-type restriction is a convenience, not a
validation.

Every transition is an `audit_event`. Illegal transitions throw in the
service layer and are covered by unit tests.
