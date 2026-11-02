# 13 — Feature Specification and Implementation Order

Authority over: what each feature does, why it exists, how to build it, and
what it connects to.

> **How to read this.** Every feature below traces to one of the four frauds
> in `docs/00-PRODUCT.md` §1. A feature that cannot name its fraud is
> decoration and does not get built.

---

## The one problem

> **A restoration claim and evidence of a restoration claim are different
> things, and today nobody can tell them apart.**

Everything in this product is one of four answers to that:

| Capability | Answers |
|---|---|
| **A — Evidence with a fixed identity** | "Is this the same file that was approved?" |
| **B — Independent review** | "Did someone other than the claimant check it?" |
| **C — Reuse detection** | "Has this photo been claimed before?" |
| **D — Public verifiability** | "Can I check this myself, without trusting Delta?" |

Features are grouped by capability, not by screen. Screens come in
`docs/14-PAGE-SPEC.md`.

---

# Capability A — Evidence with a fixed identity

**Fraud addressed:** silent tampering after approval.

## A1 — Immutable original storage

**Problem.** If the stored file can be swapped, every hash downstream is
theatre.

**What it does.** Accepts a before/after image pair (plus supplements when
more proof is requested), stores the raw bytes in a private blob store, and
never modifies them. Files go from the browser straight to the store — not
through a Server Action, because serverless body limits are low and a dropped
connection would lose the whole request. All derived values are computed from
the bytes read *back out* of storage, never from what the client sent.

**Implementation steps**

1. Define `StoragePort` in `src/server/storage/port.ts` — `put`, `get`,
   `signedUrl`, `delete`. No provider types in the signature.
2. Implement `BlobStorageAdapter` against the private blob store.
3. `submissions.createDraft(actor, projectId)` creates the submission in
   status `DRAFT` and returns its id.
4. A route handler issues a scoped client-upload token restricted to the
   allowed MIME types and 5 MB. The browser uploads each file directly to
   private blob storage. The token's content-type restriction is a
   convenience, **not** a validation.
5. Keys are `org/{orgId}/project/{projectId}/{uuid}.{ext}`. Never a
   user-supplied filename — that is a path traversal vector.
6. `submissions.finalize(actor, submissionId)` runs in **one transaction**:
   verify every expected file exists and is within limits (size ≤ 5 MB, MIME
   **sniffed from the first bytes**, not from the filename — a `.jpg`
   extension on a PDF is the simplest upload attack there is); read the bytes
   back and hash *those* — the step people skip; `DRAFT → PENDING_FORENSICS`;
   insert the forensics job; append the audit event.
7. A `DRAFT` older than 24 hours with no files is swept by a job.

**Order matters:** draft row → direct upload → read back → hash → state
transition. If the process dies between steps, you have an orphan blob or an
abandoned `DRAFT` (harmless, swept) rather than a submission pointing at
nothing (corrupt). See `docs/01-FEATURE-LOCK.md` §State machine.

**Connects to:** A2 consumes the bytes. Every forensic check reads through
this port. D2 compares a visitor's file against the hash this produces.

**Done when:** a file's `evidence_file.sha256` is reproducible by downloading
the signed URL and hashing it locally.

## A2 — Canonical manifest and manifest hash

**Problem.** Hashing a file proves the file is unchanged. It says nothing
about who approved it, when, or under what decision.

**What it does.** At approval, builds a fixed-shape JSON document describing
the whole approved record, serialises it deterministically, and hashes it.
That hash is what gets anchored.

**Implementation steps**

1. `src/lib/crypto/manifest.ts` — a pure function `buildManifest(input)`
   returning the exact field set in `docs/02-ARCHITECTURE.md` §4.4.
2. Serialise with `canonicalize` (RFC 8785). **Never `JSON.stringify`** —
   key order and number formatting differ across engines, so the browser and
   the server would produce different hashes for identical data.
3. Timestamps: ISO 8601 UTC, `Z` suffix, millisecond precision. One format,
   everywhere.
4. `manifestHash = SHA256(utf8Bytes(canonicalize(manifest)))`.
5. Write a test that runs the same input through Node and through a real
   browser (Playwright) and asserts identical output. Two Node code paths
   agreeing proves nothing.
6. Freeze the file. Mark it in `docs/12-AGENT-SCOPE.md` §3.

**Connects to:** consumed by C-group anchoring and by D1 browser verification.
This is the single most load-bearing file in the repository.

**Done when:** the cross-runtime test passes.

## A3 — Hash-chained audit log

**Problem.** An operator with database access can rewrite a review decision
and nobody would know.

**What it does.** Every state change appends a row whose hash includes the
previous row's hash. Changing any historical row breaks the chain from that
point forward, detectably.

**Implementation steps**

1. Inside the transaction that performs the state change:
   `SELECT pg_advisory_xact_lock(hashtext(org_id))`. This serialises appends
   per organisation so two concurrent writers cannot both claim sequence *n*.
2. Read the current chain head for that org.
3. `eventHash = SHA256("DELTA_AUDIT_V1:" + prevEventHash + ":" + canonicalize(payload))`.
   Genesis `prevEventHash` is 64 zeros. The domain tag prevents a hash from
   one context being replayed in another.
4. Insert with `seq = prev.seq + 1`. Unique constraint on `(org_id, seq)`.
5. Append in the **same transaction** as the state change. An audit log that
   can be skipped is not an audit log.
6. `scripts/verify-audit-chain.ts` walks every org's chain and reports the
   first broken sequence number.
7. Test: tamper one row's payload, assert verification fails at exactly that
   `seq`.

**Why the advisory lock and not just the unique constraint:** the constraint
would reject the second writer with an error. The lock makes the second
writer wait and then succeed with the correct previous hash. One is a bug
report, the other is correctness.

**Connects to:** B2 writes here on every decision. A2 embeds the chain head
in the manifest, binding the decision history to the anchored record.

**Done when:** the tamper test passes and the verify script runs clean over
5,000 seeded rows.

---

# Capability B — Independent review

**Fraud addressed:** self-auditing.

## B1 — Three tenant types and project assignment

**Problem.** "Multi-tenant" usually means data separation. Here it has to mean
*institutional* separation.

**What it does.** An organisation is an `OWNER`, a `VERIFIER`, or a `FUNDER`.
Verifiers reach a project only through an explicit assignment row created by
a platform admin.

**Implementation steps**

1. Add `org_type` to `organization` as a non-null enum.
2. `project_assignment` table, unique on `(project_id, verifier_org_id)`.
3. Every read in `projects.service.ts` takes the caller's identity and scopes
   by it. Default to invisible.
4. Cross-tenant requests return **404, not 403**. A 403 confirms the resource
   exists, which is itself a leak.
5. `test/integration/tenancy.test.ts` — for *every* service read function, a
   caller from an unrelated org gets nothing.

**Connects to:** B2 depends on assignment existing. Capability D reads the
same scoping with a null caller.

## B2 — The conflict-of-interest rule

**This is the product.** Everything else is supporting infrastructure.

**Problem.** The organisation that did the work signs off that the work was
done.

**What it does.** A review decision is valid only if the reviewer's
organisation is not the project owner, is of type `VERIFIER`, and is assigned
to the project.

**Implementation steps**

1. `assertCanReview(userId, submissionId)` in `reviews.service.ts`. One
   function. Every review path calls it.
2. One query joining submission → project → membership → assignment, so the
   check cannot pass on stale data.
3. Five rejections, in order: not visible → same organisation → not a
   verifier → not assigned → already decided by this user.
4. Call it **inside** the decision transaction, not before it. A check that
   runs outside the transaction can pass and then be invalidated before the
   write.
5. Write `test/integration/coi.test.ts` with the full table in
   `docs/04-AUTH.md` §4 **before** writing the implementation.
6. **Build no reviewer UI until that suite is green.**

**No override exists.** Not for admins, not under `DEMO_MODE`, not behind a
flag. If a requirement seems to need one, the requirement is wrong.

**Connects to:** gates B3. Produces the `review_decision` rows that A2 embeds
and A3 chains.

**Done when:** all ten cases in the table pass.

## B3 — Submission state machine with 2-of-N quorum

**Problem.** One reviewer having a bad day, or being bribed, should not be
enough.

**What it does.** Two approvals from distinct verifier users move a submission
to `APPROVED`. Two rejections make it `REJECTED`, terminal. A 1/1 split stays
`IN_REVIEW` and requires a third distinct verifier.

**Implementation steps**

1. `src/lib/state-machine/transitions.ts` — an explicit table, not scattered
   `if` statements. Illegal transitions throw.
2. Unit-test every legal and illegal pair. This is a small table and a cheap
   exhaustive test.
3. `recordDecision` in a transaction: `assertCanReview` → insert
   `review_decision` → recount → transition if the threshold is met → append
   `audit_event`.
4. Recount from rows, never from a cached counter. A counter can drift; rows
   cannot.
5. `NEEDS_MORE_PROOF` resets the tally. Prior decisions stay in the log.
6. Every decision requires a non-empty written reason. Enforce at the
   database level (`CHECK (length(trim(reason)) > 0)`) as well as in Zod.

**Why a reason instead of a confirmation dialog:** "Are you sure?" is clicked
without reading. Typing *why* makes the reviewer think, and leaves an
artefact a funder can read.

**Connects to:** `APPROVED` is the trigger for A2 and the anchoring queue.

---

# Capability C — Reuse detection

**Fraud addressed:** double-claiming and location spoofing.

## C1 — Deterministic forensic pipeline

**Problem.** A human reviewer cannot eyeball 5,000 photos for duplicates.

**What it does.** Seven deterministic checks per submission, each producing a
finding row with a severity and a human-readable reason.

**Implementation steps**

1. Port the salvaged `computeSha256`, `computeDHash` and
   `extractExifTelemetry` from `docs/salvage/`. They are correct; they just
   need to write into the new model.
2. **One shared dHash function**, imported by the pipeline, the seed script
   and the eval harness. Three copies is how an eval harness starts lying.
3. Each stage is independent and wrapped so a failure produces a `FAILED`
   finding rather than aborting the run.
4. Each stage writes a `forensic_finding` row with `kind`, `severity`,
   `reason`, `evidence` jsonb, `rule_version`.
5. `evidence` must contain enough to recompute the verdict by hand: both
   hashes, the distance, the threshold. This powers C3.
6. Severity comes from the fixed table in `docs/10-FORENSICS.md` §3. Never
   computed, never influenced by the AI.

**Why findings and not a score:** a score of 0.73 is unarguable and
unactionable. "This image is 4 bits from a submission belonging to another
organisation" is something a reviewer can investigate.

**Connects to:** feeds C3 and the Lab queue ordering. The AI appends one more
finding here (C5).

## C2 — Cross-tenant duplicate search without disclosure

**The hardest requirement in the product, and the most valuable.**

**Problem.** Catching double-claiming requires searching across
organisations. Telling Org A which project Org B submitted would be a
serious breach.

**What it does.** The Hamming search spans all tenants. The *disclosure* is
scoped: a cross-org finding says a match exists and how close, via an opaque
reference. Only an admin can resolve it, and resolving writes an audit event.

**Implementation steps**

1. Search globally:
   `WHERE (evidence_file.dhash <~> $1::bit(64)) < 8`, HNSW-indexed.
2. Classify the match by relationship: same project → `LOW`; same org,
   different project → `HIGH`; different org → `HIGH`.
3. For a cross-org match, the finding's `evidence` holds the distance, the
   threshold, the rule version, and `matchRef` — an opaque identifier. **No
   org id, no project id, no submission id, no coordinates.**
4. `matchRef` resolution is an admin-only service function that writes an
   `audit_event` naming the admin who looked.
5. `test/integration/forensics-disclosure.test.ts` — serialise every payload
   an unprivileged caller can reach and assert no cross-org identifier
   appears anywhere in it.

**Connects to:** the reviewer sees "matched another organisation, HIGH" and
escalates. Resolution is a deliberate, logged act.

## C3 — "Why was this flagged?" drill-down

**Problem.** A flag a reviewer cannot interrogate is a flag they learn to
ignore.

**What it does.** Every finding expands to show the literal inputs that
produced it.

**Implementation steps**

1. `FindingCard` renders `reason` as the headline and `evidence` in an
   expandable drawer.
2. For a perceptual match: both images side by side, both 64-bit bitstrings
   with differing bits highlighted, the Hamming distance, the threshold, the
   rule version.
3. For a geospatial finding: the polygon, the EXIF point, the distance in
   metres, the tolerance.
4. For a timestamp finding: the raw EXIF value, the project creation time,
   and which comparison failed.
5. Never render `evidence` as a raw JSON dump. A reviewer reading
   `{"d":4,"t":8}` learns nothing.

**Connects to:** the single biggest driver of reviewer trust. Build it at the
same time as the Lab, not later.

## C4 — Geospatial boundary check

**Problem.** Photos taken somewhere other than the claimed site.

**Implementation steps**

1. Store the project boundary as `geography(Polygon, 4326)`, GiST-indexed.
2. Draw it on a map at project creation. Never ask a user to type coordinates.
3. If EXIF GPS exists: `ST_Contains` for inside, `ST_Distance` for metres
   outside. `geography` gives metres on a sphere directly — no Haversine, no
   reprojection.
4. Four outcomes: inside (`INFO`), within tolerance (`INFO`), outside
   (`MEDIUM` with the distance), missing (`LOW`).
5. **Never invent a coordinate.** Absent GPS is a finding, not a mismatch and
   not a zero.

**Honesty requirement:** EXIF GPS is trivially forged. Say so on the proof
page, not in a footnote. This check raises the cost of spoofing; it does not
prevent it.

## C5 — AI advisory observation

**Problem.** Some inconsistencies are visible but not computable — a photo of
a screen, a stock image, a scene unrelated to the activity.

**What it does.** One low-weight qualitative finding per submission.

**Implementation steps**

1. Runs as a **job**, never inline. The submission must be fully reviewable
   with this finding absent.
2. Zod schema with enums only — no free numbers, no `approved` boolean.
   There is no field through which an instruction in the image could take
   effect.
3. Validation failure, quota, timeout and a missing key all produce
   `ai_unavailable`. Never partially trusted, never hand-repaired.
4. Severity capped at `LOW`. Score weight a fraction of any deterministic
   finding, and the weight is visible in the breakdown.
5. Rendered below the deterministic findings, muted, headed **Advisory
   observation — not evidence**.

**Never ask it to count anything.** "AI counted 200 trees" is on the CUT
list. Invented quantities read as data and are not data.

---

# Capability D — Public verifiability

**Fraud addressed:** all four, by making the record checkable by strangers.

## D1 — Browser-side proof verification

**Problem.** A server that says "verified ✓" is asking to be trusted. That is
the thing we are trying to remove.

**What it does.** The visitor's own browser recomputes the manifest hash and
verifies the Merkle proof against the chain.

**Implementation steps**

1. Fetch the canonical manifest from the public proof endpoint.
2. Recompute `SHA256(canonicalize(manifest))` with `crypto.subtle`, using the
   same frozen `src/lib/crypto` code the server used.
3. Rebuild the leaf, then `eth_call` the contract's `verify` through a public
   RPC. No key needed, so no secret reaches the browser.
4. Render one of four states: `MATCH`, `MISMATCH`, `PENDING`, `UNAVAILABLE`.
5. **Show the work.** Display the manifest JSON that was hashed, the hash, the
   leaf, the proof path and the root. A visitor who distrusts the page must be
   able to redo it with `cast`.

**The most dangerous bug in this product** is rendering `MISMATCH` when the
RPC is merely unreachable. That is a false accusation of tampering against an
honest organisation. `UNAVAILABLE` is neutral grey, always.

## D2 — Drop the original photo

**Problem.** Hash comparison is abstract. People need to *feel* that it works.

**What it does.** The visitor drags the original photo onto the page. The
browser hashes it locally and compares to the manifest.

**Implementation steps**

1. `crypto.subtle.digest("SHA-256", bytes)` in the browser.
2. Compare to the `sha256` of each entry in the manifest's `files` array.
3. Animate the comparison character-group by character-group, settling green.
   This is the one place animation genuinely explains something.
4. **State next to the dropzone that the file never leaves the device.** Not
   in a footnote. People will not drop a file they think is being uploaded.
5. On mismatch, say which hash was expected and which was computed. A bare
   red X teaches nothing.

**This is the demo moment.** It is also the most honest thing on the page:
the visitor's own machine does the work.

## D3 — Merkle batching and daily anchoring

**Problem.** One transaction per approval does not fit a zero-cost budget.

**Implementation steps**

1. Select `APPROVED` submissions with a manifest and no existing leaf.
2. Build the tree with `StandardMerkleTree`, leaves sorted ascending by
   submission id so the tree is reproducible from the public API.
3. **Write `anchor_batch` and `anchor_leaf` rows with proofs before sending
   the transaction.** If the process dies, a `SUBMITTED` batch with a tx hash
   is recoverable by polling; one that exists only on chain is not.
4. Send, poll for the receipt, then mark `CONFIRMED` and move submissions to
   `ANCHORED`.
5. On revert: `FAILED` with the reason, submissions return to `APPROVED` for
   the next batch.
6. Unique `(submission_id, manifest_version)` — the database refuses to
   double-anchor a version.

**Say in the README that batching is a cost decision.** It is a legitimate
engineering answer to a real constraint, and explaining it is better than
hiding the 24-hour window.

## D4 — Public API and printable certificate

**Implementation steps**

1. `/api/v1/submissions/[id]/proof` is **public and unauthenticated** —
   independent verification is the point. Returns fuzzed geometry and the
   commitment, never the salt.
2. Hashed API keys for the authenticated read endpoints: store
   `key_prefix` + SHA-256 `key_hash`, look up by prefix, compare in constant
   time, revoke by timestamp.
3. Print stylesheet on the proof route. Funders need paper. Zero dependencies.

## D5 — Coordinate fuzzing and location commitment

**Problem.** Publishing exact restoration site coordinates can endanger the
site.

**Implementation steps**

1. Store exact geometry plus a per-project random salt.
2. `locationCommitment = SHA256("DELTA_LOC_V1:" + salt + ":" + canonicalize(exactGeoJson))`.
3. Public responses carry `fuzzedLocation` (area-level centroid) and the
   commitment. **Never** `exactGeoJson`, **never** the salt.
4. Authorised sessions get both, so they can verify the commitment themselves.
5. The **server** decides which geometry a caller receives. The map component
   renders what it is handed and has no opinion.
6. `test/integration/fuzzing-leak.test.ts` — hit every public endpoint and
   every tile response unauthenticated, assert neither field appears.

---

# Capability E — Operator experience

Not fraud mitigation. These are the features that make the product usable
rather than merely correct, and two of them are the highest
effort-to-value ratio in the build.

## E1 — Keyboard-driven review queue

**Half a day of work. The largest usability win in the product.**

A verifier reviews hundreds of submissions. `j`/`k` to move, `Enter` to open,
`a` approve, `r` reject, `m` request more proof, `?` for the shortcut sheet.

Every shortcut has a visible button. Never keyboard-only — that is an
accessibility failure, not a power feature.

Auto-advance after a decision, with a brief undo window **before** the write
commits. Once written, a decision is permanent.

## E2 — Offline-first field capture

**The most product-real feature in the build, and none of the earlier drafts
had it.**

A field worker in the Sundarbans has no signal. Capture → hash on device with
`crypto.subtle` → queue in IndexedDB → sync on reconnect.

**Implementation steps**

1. Service worker caching the shell and the submit route.
2. On file selection, hash immediately and store bytes + hash + metadata in
   IndexedDB.
3. Queue UI showing each pending item with its state.
4. Sync on `online`, with retry and visible per-item status.
5. The client hash travels as `client_sha256` (per file) and is recorded as an
   **earliest-known-existence signal, explicitly labelled weak**. The server
   recomputes from stored bytes and that is authoritative.
6. A mismatch between client and server hash is a `MEDIUM` finding.

**Never silently drop a queued submission.** A field worker who loses a day's
captures will not come back.

## E3 — Async job pipeline with visible progress

The forensic pipeline takes seconds. Blocking the request for it is wrong,
and so is hiding it.

`FOR UPDATE SKIP LOCKED` queue with attempts, exponential backoff and
idempotency keys. Drained by `after()` on submit, an hourly safety net, and an
admin retry button. Stuck jobs surface in admin rather than disappearing.

The UI shows per-stage progress (D in `docs/15-UI-STATES.md` §4), because
"processing…" for fifteen seconds feels broken.

## E4 — Tamper demo and deterministic replay

Both `DEMO_MODE` only.

**Tamper demo** mutates one audit row in a sandbox organisation and shows
chain verification failing at that exact sequence number. This is the
interview moment — it is the difference between claiming tamper-evidence and
demonstrating it.

**Replay** re-runs the deterministic pipeline on a stored submission and
asserts byte-identical findings, excluding the AI. It proves the pipeline is
reproducible, which is the actual engineering claim.

---

# Connecting the dots

The full chain, and what breaks if a link is missing:

```
A1 stores bytes
   └─► C1 computes findings from those bytes          (no A1 → nothing to hash)
         └─► C2 classifies cross-tenant matches        (no C1 → no duplicates caught)
               └─► C3 makes findings interrogable      (no C3 → reviewers ignore flags)
                     └─► B2 gates who may decide       (no B2 → self-approval, no product)
                           └─► B3 requires two voices  (no B3 → one person decides)
                                 └─► A3 chains the record  (no A3 → history editable)
                                       └─► A2 builds the manifest  (no A2 → nothing to anchor)
                                             └─► D3 anchors a batch
                                                   └─► D1 lets a stranger verify
                                                         └─► D2 makes it tangible
```

Read it backwards to see why the build order in `docs/11-IMPLEMENTATION.md` is
what it is. D1 is worthless without A2. A2 is worthless without B2. **B2 is
the load-bearing wall, which is why Stage 2 is a hard gate.**

## Build order, by feature

| Stage | Features |
|---|---|
| 1 | Schema and extensions for all of them |
| 2 | **B1, B2, B3** — the gate. No UI. |
| 3 | D5, A1 (the port), public read path |
| 4 | A1 (full), C1, C4, E2, E3 |
| 5 | A3, C2, C3, C5, E1, B3 UI |
| 6 | A2, D3 |
| 7 | D1, D2, D4 |
| 8 | E4, eval numbers, polish |

## Feature → fraud traceability

Keep this table in the README. It is the clearest possible statement of why
each piece exists.

| Fraud | Features |
|---|---|
| Double claiming | C1, C2, C3 |
| Location spoofing | C4, D5, E2 |
| Self-auditing | B1, B2, B3 |
| Silent tampering | A1, A2, A3, D1, D3, E4 |
| *All four, made checkable* | D1, D2, D4 |
