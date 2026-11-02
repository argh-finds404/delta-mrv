# Threat Model

Who attacks Delta, how, and what stops them. Summarised publicly in the
README and on `/about`.

---

## Assets

| Asset | Why it matters |
|---|---|
| Original evidence bytes | The only primary record. Everything else is derived. |
| Review decisions and audit chain | The accountability record |
| Exact project geometry and salts | Can reveal sensitive restoration sites |
| Anchor signer private key | Can write junk batches on chain |
| Anchored Merkle roots | The public integrity reference |

## Adversaries

**A1 — Fabricating NGO.** Wants funding for work not done.
**A2 — Double-claiming NGO.** Did the work once, claims it against several grants.
**A3 — Colluding verifier.** Approves a partner organisation's weak evidence.
**A4 — Insider with database access.** Wants to rewrite history after approval.
**A5 — Opportunist.** Wants another organisation's private site coordinates.
**A6 — Platform operator (Delta itself).** The system must be checkable without trusting us.

---

## Threats and mitigations

### T1 — Reusing a photograph across projects or grants (A2)
**Mitigation:** Global SHA-256 and 64-bit dHash Hamming search across all
tenants. Same org / different project and cross-org matches are `HIGH`.
**Residual:** A sufficiently re-shot or heavily transformed image evades
dHash. The eval harness publishes the miss rate. Rotation beyond a small
angle is a known blind spot.

### T2 — Photograph taken outside the claimed boundary (A1)
**Mitigation:** Server-side EXIF GPS checked against a PostGIS polygon with
an explicit tolerance. Distance recorded in the finding.
**Residual:** EXIF GPS is trivially forged. This is stated plainly on every
proof page. NDVI cross-check and signed capture are the stretch mitigations.

### T3 — Self-approval (A3)
**Mitigation:** The conflict-of-interest rule, enforced in the service layer
with no override, plus 2-of-N quorum from distinct verifier users, plus
explicit per-project assignment controlled by an admin.
**Residual:** Two genuinely distinct organisations can still collude. Delta
makes collusion visible and attributable — every decision is named, reasoned
and permanently recorded — but cannot prevent it. Reputation and real-world
inspection remain necessary.

### T4 — Rewriting history after approval (A4, A6)
**Mitigation:** Append-only tables enforced by revoked grants and triggers;
a per-organisation hash chain over RFC 8785 canonical JSON serialised with an
advisory lock; daily Merkle anchoring to a public chain.
**Residual:** An operator with superuser database access can drop triggers
and rewrite rows — but cannot change what is already anchored. The
divergence becomes publicly detectable the moment anyone recomputes a
manifest. This is exactly what the public proof page lets a stranger do.

### T5 — Leaking sensitive site coordinates (A5)
**Mitigation:** Server-side fuzzing. Unauthenticated API responses, map tiles
and proof pages receive area-level geometry plus a salted commitment, never
the exact polygon or the salt. Leak tests assert this for every public
endpoint.
**Residual:** Repeated queries across many fuzzed centroids could narrow a
location. Fuzzing granularity is a documented parameter.

### T6 — Prompt injection via evidence imagery (A1)
**Mitigation:** AI output is schema-constrained with no field through which
an instruction could take effect; there is no `approved` boolean in the
schema. The system prompt treats in-image text as content to describe, not
instruction to follow. AI severity is capped at `LOW` and can never change a
status.
**Residual:** A model can still be induced to produce a misleading
observation. Since the observation decides nothing, the blast radius is one
advisory card a reviewer may ignore.

### T7 — Cross-tenant information disclosure through findings
**Mitigation:** A cross-organisation match discloses only that a match exists
and its Hamming distance, via an opaque `matchRef`. Only an admin can resolve
it, and resolution writes an audit event.
**Residual:** The existence of a match is itself a small signal. Accepted —
without it, double-claiming cannot be surfaced to the reviewer at all.

### T8 — Anchor key compromise
**Mitigation:** Server-only environment variable, used in exactly one file,
never logged. `Ownable2Step` ownership; a batch id can be anchored once.
Testnet funds only.
**Residual:** An attacker can anchor junk batches, creating noise. They
cannot alter or delete existing anchors, and junk batches are not linked to
any submission so they never surface in a proof page.

### T9 — Showing a network failure as tampering
**Mitigation:** Four distinct verification states. `UNAVAILABLE` and
`PENDING` are neutral. Only a genuine hash divergence renders `MISMATCH`.
**Why it is listed as a threat:** a false accusation of tampering is a
serious harm to an honest organisation.

### T10 — Evidence loss through external service failure
**Mitigation:** Explicit status on every pipeline stage. Blob write precedes
submission creation. AI failure degrades to `ai_unavailable`. Job queue has
attempts, backoff and a stuck state surfaced in admin. A failed anchor
returns submissions to `APPROVED` for the next batch.

---

## Out of scope

- Real-world verification that an activity physically occurred
- Identity verification of organisations beyond email registration
- DDoS and platform availability
- Compromise of the hosting provider or the database provider
- Legal enforceability of any record produced here

## What a reader should conclude

Delta raises the cost of the four common frauds from near zero to meaningful,
makes tampering detectable by strangers, and records accountability in a way
the operator cannot quietly revise. It does not make environmental claims
true. Anyone who tells you a platform like this proves trees exist is selling
something.
