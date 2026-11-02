# 16 — Amendments v2

Authority: **this file overrides the documents it names.** Where a numbered
doc and this file disagree, this file wins until the numbered doc is edited
to match.

**Date:** 2026-11-02
**Source:** external review of the v1 doc set. Accepted items only; rejected
items are listed in §B so they do not come back.

---

# A. Accepted amendments

## A1 — Quorum: add `ESCALATED`, resolved by a verifier-org admin

**Amends:** `docs/01-FEATURE-LOCK.md` §State machine, `docs/04-AUTH.md` §4,
`docs/14-PAGE-SPEC.md` §5.

**This closes the last open decision.** The previous rule — a 1/1 split
requires a third distinct verifier — is replaced.

```
IN_REVIEW ──┬─► APPROVED        2 approvals from distinct verifier users
            ├─► REJECTED        2 rejections from distinct verifier users
            ├─► ESCALATED       1 approve + 1 reject
            └─► NEEDS_MORE_PROOF  any reviewer requests more proof

ESCALATED ──┬─► APPROVED
            └─► REJECTED        deciding vote by a verifier-org ADMIN
```

**Why this is safe and the earlier objection was misplaced.** The concern was
that an admin tie-break is a hole through the conflict-of-interest rule. That
is true of a **platform** admin. It is not true of an **admin inside an
assigned verifier organisation** — that person is independent of the project
owner, subject to the same `assertCanReview` checks, and their vote is
attributable and hash-chained like any other.

**Rules**

- The escalation voter must pass the full `assertCanReview` gate, plus
  `role === 'admin'` within a `VERIFIER` org assigned to the project.
- They must not have already voted in this round. An admin who already voted
  cannot break their own tie.
- A platform admin still cannot vote. `docs/12-AGENT-SCOPE.md` §3 is unchanged
  on that point.
- The escalation decision requires a reason like any other.

**UI:** `/lab` shows *"Split decision — awaiting a deciding vote from a
verifier administrator."* A verifier admin sees escalated items pinned to the
top of their queue.

## A2 — Split evidence files into their own table

**Amends:** `docs/03-DATABASE.md` §4.

The current schema puts before/after on `evidence_submission` as paired
columns (`before_sha256`, `after_sha256`, `before_dhash`, …). That cannot
hold a third file, which `NEEDS_MORE_PROOF` requires: an owner adding
supplementary evidence has nowhere to put it.

**Replace those columns with:**

```
evidence_file
  id              uuid PK
  submission_id   uuid FK
  role            enum('BEFORE','AFTER','SUPPLEMENT')
  storage_key     text
  mime            text
  size_bytes      integer
  sha256          char(64)
  client_sha256   char(64)        nullable — PWA capture, weak signal
  dhash           bit(64)         nullable — HNSW bit_hamming_ops
  exif            jsonb
  gps             geography(Point,4326)  nullable
  captured_at     timestamptz     nullable
  round           integer         which round this file belongs to
  created_at      timestamptz
```

Unique `(submission_id, role, round)` for `BEFORE` and `AFTER`. Supplements
are unconstrained in count.

**Knock-on changes**

- The duplicate search queries `evidence_file.dhash`, not submission columns.
- The manifest (`docs/02-ARCHITECTURE.md` §4.4) lists files as an ordered
  array of `{role, sha256, dhash}` sorted by `(role, round)`, not as four
  flat fields. **This changes the manifest shape, so bump the schema string
  to `"delta.manifest.v2"`** before any anchoring exists. Do it now, not
  later.
- `forensic_finding` gains a nullable `evidence_file_id` so a finding can
  point at the specific file it concerns.

## A3 — Explicit review rounds

**Amends:** `docs/01-FEATURE-LOCK.md` §State machine, `docs/03-DATABASE.md` §4.

"`NEEDS_MORE_PROOF` resets the tally" was underspecified. Model it.

- `evidence_submission.round` integer, starts at 1.
- `review_decision.round` integer.
- Unique `(submission_id, round, reviewer_user_id)` — one decision per
  reviewer per round.
- `NEEDS_MORE_PROOF` → owner adds a supplement → `round += 1` →
  `IN_REVIEW`. Prior decisions remain in the table and in the audit chain;
  they simply belong to an earlier round and do not count toward quorum.
- Quorum is always evaluated over the **current round only**.

A reviewer who approved in round 1 may decide again in round 2. That is
correct — new evidence is a new question.

## A4 — Blind until vote

**Amends:** `docs/14-PAGE-SPEC.md` §5, `docs/13-FEATURE-SPEC.md` B3.

A reviewer cannot see other reviewers' decisions or reasons for the current
round until they have submitted their own.

**Why this is worth building.** Without it, the second reviewer sees "approved
by a colleague" and rubber-stamps. Anchoring bias is the most likely way a
2-of-N quorum degrades into 1-of-N in practice — and a quorum that is
functionally one person is the thing the whole feature exists to prevent.

**Implementation**

- `review.getWorkspace(actor, id)` omits current-round decisions when
  `actor` has not yet decided this round. Filter in the **service**, never in
  the component — data the client receives is data that leaked.
- The quorum meter still shows the *count* (`1 of 2 approvals`), because
  knowing someone has voted is not the same as knowing how.
- After the reviewer votes, the full round becomes visible.
- Earlier rounds are always visible — that is context, not peer pressure.
- Test: assert the response payload contains no other reviewer's `decision`
  or `reason` before the caller has voted.

## A5 — Draft state and direct client upload

**Amends:** `docs/01-FEATURE-LOCK.md` §State machine,
`docs/13-FEATURE-SPEC.md` A1, `docs/14-PAGE-SPEC.md` §6.

Routing 5 MB files through a Server Action is fragile — serverless body
limits are low and a dropped connection loses the whole request.

**New flow**

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

`DRAFT` is added to the state machine as the initial state. A draft older
than 24 hours with no files is swept by a job.

**The authority rule is unchanged and critical:** the server reads the bytes
back out of storage and hashes those. A client-supplied hash is never
authoritative, and the upload token's content-type restriction is a
convenience, not a validation.

## A6 — Split public and workspace project routes

**Amends:** `docs/05-ROUTES.md`, `docs/14-PAGE-SPEC.md` §3.

`/projects/[id]` currently serves both anonymous and authenticated callers,
filtering fields by caller. That is one route whose output depends on auth
state, which is precisely where geometry and status leaks happen.

**Split them:**

| Route | Caller | Data |
|---|---|---|
| `/p/[slug]` | public | Area-level geometry. Approved submissions only. |
| `/projects/[slug]` | workspace members | Exact geometry. All statuses. |

Two routes, two service functions, two tests. The public route has no branch
on session at all, which makes the leak test meaningful: there is no
authenticated code path to accidentally reach.

Slugs rather than ids on the public route — they are shareable and they do not
leak row counts.

## A7 — `/verify` reverse lookup

**Amends:** `docs/05-ROUTES.md`, `docs/13-FEATURE-SPEC.md` capability D.

A public page accepting a proof id, a transaction hash, or a dropped file.
The file is hashed **in the browser**; only the SHA-256 is sent.

Returns either a link to the proof dossier, or no match.

**The copy on a miss matters, and must be exactly this careful:**

> **No match found.** This file is not in Delta's anchored records. That does
> not mean it is fake — it may simply never have been submitted here.

A verification tool that implies absence is guilt is worse than no tool. Get
this sentence right or do not ship the page.

## A8 — `/trust` replaces `/about`, and is a MUST

**Amends:** `docs/05-ROUTES.md`, `docs/01-FEATURE-LOCK.md`.

Rename and upgrade. `/trust` contains:

- What Delta proves — verbatim from `docs/00-PRODUCT.md` §3
- What it does not prove — verbatim
- Every finding kind and its severity rule, as a table
- **Measured precision and recall**, read at build time from the eval
  harness output — not prose, actual numbers, including the known misses
- Threat model summary, linking to `docs/THREAT_MODEL.md` and the ADRs
- How coordinate fuzzing works and why
- Roadmap: satellite cross-check, signed capture

Publishing your own measured failure rate is the single most credible thing on
the site. It is also the page a technical evaluator will read first.

## A9 — `project_funder` and scoped funder access

**Amends:** `docs/03-DATABASE.md` §4, `docs/04-AUTH.md` §5.

A funder currently sees every approved record. Real funders see the projects
they fund.

`project_funder` table, unique `(project_id, funder_org_id)`, created by the
project owner. Funder reads join through it.

The public pages remain public — this scopes the funder *portal*, not the
proof dossiers.

## A10 — Verified green is a fill colour, not a text colour

**Amends:** `docs/06-DESIGN-SYSTEM.md` §2.

Mid-tone greens on a near-black background fail WCAG AA for normal text.
Compute every pairing before shipping and fix the token rather than waiving
the check.

**Rules**

- `--verified` is used for **fills, borders and large icons only**.
- Text on a `--verified` fill is white or `--field-abyss`, whichever measures
  higher — never `--signal` lime, which is too close in luminance.
- Small "verified" text uses `--field-text` with a `--verified` icon beside
  it.
- Same rule on Paper: `--paper-seal` for fills; a darker ink for text.
- Add a contrast assertion to the Stage 8 accessibility pass covering every
  semantic token against both its backgrounds.

## A11 — Minimal service worker, nothing authenticated cached

**Amends:** `docs/15-UI-STATES.md` §5.

The earlier instruction to cache "recently viewed submissions" is withdrawn.
Caching authenticated evidence in a service worker puts tenant data in the
browser cache, where it survives sign-out and is readable by any later user
of the device.

**The service worker caches exactly one thing: a static offline page.**

```js
const CACHE = "delta-offline-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/offline.html")));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
});
```

`/offline.html` is static, inline CSS, **no framework JavaScript** — so it
works when the app chunks themselves failed to load.

The offline **capture queue** is unchanged and stays in IndexedDB. That is the
field worker's own pending work, not another tenant's evidence. Clear it on
sign-out.

Register in production only. Do not add a PWA library.

## A12 — Cached risk score, with conditions

**Amends:** `docs/03-DATABASE.md` §4, `docs/10-FORENSICS.md` §6.

I previously forbade a score column outright. That was right about semantics
and wrong about storage: sorting a 5,000-row Lab queue by a score computed
from a join over findings is slow, and queue ordering is a core interaction.

**Store it, under four conditions:**

1. Columns are `risk_score`, `risk_band`, `scoring_version` on
   `evidence_submission`.
2. The value is **only ever written by the pure function** in
   `src/lib/scoring/`. Never by hand, never by the AI, never by an admin.
3. `scoring_version` is stored with it, so a weights change does not silently
   rewrite history. Old submissions keep their original version.
4. **It is never rendered without its findings beside it**, and it never
   gates a transition. A reviewer with a `concern` band can approve; one with
   `clear` can reject. Both write a reason.

The thing being prevented was an unexplainable number that decides outcomes.
A versioned cache of an explainable function, always shown with its inputs,
is not that.

## A13 — Minimum reason length

**Amends:** `docs/01-FEATURE-LOCK.md` §State machine, `docs/03-DATABASE.md` §4.

"Non-empty" permits `ok`. Require **20 characters minimum**, enforced in Zod
and by a database `CHECK` constraint.

Offer two or three quick-insert phrases in the UI that the reviewer then
edits — faster than typing from scratch, and still a real sentence.

## A14 — No email, and say so

**Amends:** `docs/07-DEPENDENCIES.md` §6, `docs/04-AUTH.md`.

Zero-cost means no transactional email provider. Therefore:

- Invitations are **copyable links** with a role and an expiry, shown once.
- No email verification. No password reset by email.
- Alerts are in-app lists and webhooks.

State this plainly on `/trust` as a stated limitation of the demonstration
build rather than letting someone discover a dead "forgot password" link.

## A15 — Separate table for exact locations

**Amends:** `docs/03-DATABASE.md` §4.

*The one good idea from the Gemini review.* Rather than relying on every query
remembering not to select `location_salt` and the exact boundary, move them
out:

```
project_private_location
  project_id      uuid PK FK
  boundary        geography(Polygon,4326)
  location_salt   bytea
```

`impact_project` keeps only `public_cell` / `fuzzed_centroid` and
`location_commitment`.

Defence in depth: a careless `SELECT *` on `impact_project` can no longer
leak exact geometry, because it is not in that table. The spatial checks join
explicitly, which makes every exact-geometry read visible in review.

---

# B. Rejected — do not reintroduce

| Proposal | Why rejected |
|---|---|
| Glassmorphism, `backdrop-filter: blur()` | `docs/06-DESIGN-SYSTEM.md` §5. It is the single clearest marker of generated UI. |
| Glowing radar sweeps, pulsing outlines, animated contour backgrounds | Decorative motion. §6 permits motion that explains a mechanism, nothing else. |
| Shimmer skeletons with diagonal gradients | Flickers during streaming DOM updates. A slow opacity pulse, or nothing. |
| Emoji in persona cards or any product UI | §5. |
| "Make it feel like a $50M enterprise system" | Aesthetic cosplay. Make it feel like a tool someone uses for six hours. |
| `ST_DistanceSphere` on `geometry` | `geography` + `ST_Distance` gives metres on a sphere with no reprojection. ADR-0003. |
| Merkle leaf `["bytes32","string","uint256"]` | Variable-length type in a fixed leaf. ADR-0005 keeps `["bytes32","bytes32","uint256"]`. |
| `GPS_MISSING` at `MEDIUM` | Stripped EXIF is extremely common — messaging apps, older phones, privacy settings. `MEDIUM` floods the queue and trains reviewers to ignore findings. Stays `LOW`. |
| `IDENTICAL_BEFORE_AFTER_ERROR` only at Hamming 0 | Too narrow. `NO_VISIBLE_CHANGE` at Hamming < 4 already covers it and catches near-identical pairs. |
| Platform-admin tie-break | Breaches B2. A1 resolves this inside a verifier org instead. |
| `/workspace/*` route prefix | Cosmetic. `docs/05-ROUTES.md` groups are already locked and referenced across the set. |
| Magic-link sign-in | Requires an email provider. See A14. |
| ⌘K command palette | Adds a dependency for a nice-to-have. Not in this scope. |

---

# C. What to do with this file

1. Commit it as `docs/16-AMENDMENTS-v2.md`.
2. Add it to the document map in `CLAUDE.md`, marked **read first**, with the
   line: *"Overrides any numbered document it names."*
3. Fold the amendments into the numbered documents as you reach each stage,
   deleting each item from here as it lands. When this file is empty, delete
   it.

Do not skip step 2. An amendments file the agent does not read is worse than
no amendments file, because the numbered docs now contain decisions that have
been superseded.

**Schema-affecting amendments — must land before Stage 1c generates any
migration:** A2, A3, A5, A9, A12, A15.
