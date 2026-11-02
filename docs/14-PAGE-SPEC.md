# 14 — Page Specification

Authority over: what each page is for, who lands on it, which features appear,
and in what order.

> **Read `docs/06-DESIGN-SYSTEM.md` first.** This document says *what* goes on
> each page. That one says *how it looks*. Feature codes (A1, B2, …) refer to
> `docs/13-FEATURE-SPEC.md`.

---

## The page inventory

| Route | Theme | Primary user | Job |
|---|---|---|---|
| `/` | Paper | Stranger | Understand the problem in 20 seconds |
| `/atlas` | Paper | Stranger, funder | See where work is happening |
| `/projects/[id]` | Paper | Funder, verifier | Judge one project |
| `/proof/[id]` | Paper | Stranger, auditor | Verify one record independently |
| `/about` | Paper | Sceptic | Read the limits |
| `/sign-in`, `/sign-up` | Field | Returning user | Get in, fast |
| `/demo` | Field | Recruiter | Try it without signing up |
| `/dashboard` | Field | Any member | Know what needs me |
| `/projects/new` | Field | Owner | Define a boundary |
| `/projects/[id]/submit` | Field | Field worker | Submit evidence, possibly offline |
| `/submissions/[id]` | Field | Owner, verifier | Inspect one submission fully |
| `/lab` | Field | Verifier | Clear a queue |
| `/lab/[id]` | Field | Verifier | Decide one case |
| `/admin` | Field | Admin | Keep the machine running |

Three pages carry the product: **`/lab`** is where the work happens,
**`/proof/[id]`** is where the trust is created, **`/projects/[id]/submit`** is
where the evidence enters. Spend your design effort there, in that order.

---

# 1 — `/` Landing

**Who lands here.** A recruiter with 40 seconds. A funder sent a link. A
stranger who found it.

**The one job.** Make them understand that restoration claims are unverifiable
today, and that this page can prove one specific claim right now.

**The trap to avoid.** A centred headline, a subtitle, two buttons, and a
glowing orb. That exact layout is the generated-landing-page signature and it
tells a recruiter the project is a template. Use an asymmetric split with a
*real artefact* on the right.

## Sections, in order

**1. Hero — asymmetric split**

Left: one sentence of problem, one sentence of mechanism, one primary action.
Right: a live `VerificationBadge` from a real seeded proof, with its real
transaction hash, linking to the dossier.

> *"We planted 500 mangroves."*
> Anyone can say it. Almost nobody can check it.
> Delta makes the evidence, the reviewer, and the review itself checkable by
> a stranger with a browser.

**Primary action:** "Open a verified record" → a real `/proof/[id]`. Not
"Get started". Not "Sign up". The best thing you can do with a stranger's
first click is show them the product working.

**No chain language above the fold.** The word appears in section 5 and
nowhere earlier.

**2. The four frauds** — four short cards, no icons, no illustrations. Each
names a fraud in the claimant's own voice and one line on what catches it.
This is the most persuasive block on the page because it is concrete.

**3. How it works** — the six-step chain from `docs/13-FEATURE-SPEC.md`
§Connecting the dots, as a horizontal sequence. Six nodes, one line each.
Not a diagram with twelve boxes.

**4. One real record** — an embedded fragment of an actual proof dossier:
project, both hashes, the two reviewer decisions with their written reasons,
the anchor. Real seeded data, never a mock. A "see the full record" link.

**5. How the integrity works** — the only section that says *blockchain*.
Merkle batching in three sentences, why a daily batch, and the honest note
that this is a testnet.

**6. What this does not prove** — verbatim from `docs/00-PRODUCT.md` §3, in a
bordered block, not a footnote.

This section is the most counter-intuitive thing on the page and the most
valuable. Every competitor overclaims. Being the one that states its limits is
the credibility moat — and a technical reader will trust the rest of the page
*because* of it.

**7. Footer** — repo link, API docs, threat model, about.

## Not on this page

No pricing. No testimonials. No "trusted by" logos. No team section. No
newsletter capture. No animated statistics. If a number appears, it is
computed from the seeded database at request time or it is deleted.

---

# 2 — `/atlas` Impact Atlas

**Features:** M4, D5, B1.

**Who lands here.** A funder browsing. A stranger who clicked "explore".

**The job.** Make the geographic reality legible, without leaking site
locations.

## Layout

Full-bleed map, controls overlaid top-left, filter pills top-centre, a
slide-over drawer from the right when a project is selected.

## The critical rule

**The server decides which geometry the client receives.** An unauthenticated
request gets fuzzed centroids. An authorised session gets exact polygons. The
map component renders what it is handed and has no branch on auth state.

There is no client-side `if (session) showExact()`. That pattern is how
geometry leaks — it ships the exact data to the browser and merely hides it.

## Drawer contents

Project title, owner organisation, activity type, reported impact, submission
count by status, verification status, and a link to the project page. For an
authorised viewer, the exact boundary and the commitment verification.

## Filters

Activity type, verification status, organisation. Filtering is client-side
over already-loaded data — it must feel instant. New geography is a server
fetch.

## Design notes

Keyless open vector tiles. Polygons filled at low opacity with a 1px stroke,
status-coloured. No markers with icons — a polygon *is* the data. No clustering
animation. No fly-to on load; that disorients.

---

# 3 — `/projects/[id]` Project detail

**Features:** B1, D5, plus a read-only view of the submission history.

**Who lands here.** A funder evaluating. A verifier orienting before review.

**The job.** Let someone judge a project's track record, not just its claim.

## Layout, top to bottom

1. **Header** — title, owner organisation, activity type, status
2. **The claim and the record, side by side** — reported impact next to
   approved-and-anchored count. The gap between them is the most honest number
   on the page. Show it even when unflattering.
3. **Boundary map** — fuzzed or exact per caller
4. **Evidence timeline** — chronological submissions with status and findings
   count. Approved ones link to their proof dossier.
5. **Verifier organisations** — who is assigned. Naming the auditors is part
   of the accountability.
6. **Limits footer**

## Visibility by caller

| Caller | Sees |
|---|---|
| Anonymous, funder | Approved submissions only. Fuzzed geometry. |
| Owner member | Everything, including rejected and in-review. Exact geometry. |
| Assigned verifier | Everything. Exact geometry. |
| Unassigned verifier | Same as anonymous. |

A rejected submission is never public. An organisation whose weak evidence was
caught should not be publicly pilloried by a system that cannot prove intent.

---

# 4 — `/proof/[id]` Public proof dossier

**Features:** D1, D2, D3, D4, D5, A2.

**The most important public page in the product.** It must work with no
session, no account, and — for everything except verification — no JavaScript.

**Who lands here.** A stranger sent a link. An auditor checking a claim. A
recruiter following the demo.

**The job.** Let someone verify a record without trusting Delta.

## Layout

Single column, generous measure, Paper theme, Newsreader serif. It should read
like a certificate, because that is what it is. No sidebar. No navigation
chrome competing with the content.

## The eight sections, in this exact order

**1. Header** — project, owner organisation, verifier organisation, activity,
reported impact, approval date. Reads like the front of a certificate.

**2. Verification state** — one of four states, computed **in the browser**,
never asserted by the server. Placed second because it is why the visitor
came.

| State | Colour | Meaning |
|---|---|---|
| `MATCH` | chain violet | Recomputed hash is in the anchored tree |
| `MISMATCH` | fraud red | The record differs from what was anchored |
| `PENDING` | review amber | Approved, batch not yet confirmed |
| `UNAVAILABLE` | neutral grey | RPC unreachable |

**`UNAVAILABLE` must never render as `MISMATCH`.** A network failure shown as
evidence of tampering is a false accusation against an honest organisation. It
is the single most damaging bug this page can have.

**3. Evidence** — before and after, each with its full 64-character SHA-256
in monospace. Never truncated here; this is where someone verifies.

**4. Drop the original photo** — the interactive verifier.

Place it high. It is the moment the abstraction becomes real.

A clear dropzone, and **next to it, not in a footnote: "This file is hashed in
your browser. It is never uploaded."** People will not drop a file they think
is being sent somewhere.

On match: animate the comparison settling green. On mismatch: show both
hashes, expected and computed. A bare red X teaches nothing.

**5. Decision record** — each reviewer decision with its written reason,
reviewer organisation, and timestamp. Reasons are rendered as escaped text.

This section is why the written-reason requirement exists. A funder reading
*"GPS 40 m outside boundary but within stated tolerance; species consistent
with planting records"* learns more than any score could tell them.

**6. Location** — fuzzed map plus the salted commitment, with a one-line
explanation of why the exact location is withheld. An authorised signed-in
viewer additionally sees the exact polygon and can verify the commitment.

**7. Chain anchor** — chain id, contract address, transaction hash linking to
the block explorer, block number, Merkle root, leaf index, proof path.

**Show the work.** Display the manifest JSON that was hashed, the resulting
hash, the leaf, and the root. A visitor who distrusts this page must be able
to reproduce every step from a terminal. That is the entire point.

**8. What this does not prove** — verbatim. Permanent. Not collapsible.

## Print

`/proof/[id]/print` — print stylesheet, no navigation, no interactive
elements, URLs expanded as footnotes, hashes in full with line breaks that
survive printing. Funders need paper.

---

# 5 — `/lab` Evidence Lab

**Features:** E1, B2, B3, C3, C5, A3.

**The page where the actual work happens.** Design for someone reviewing a
hundred submissions in a sitting, not three.

**Who lands here.** A verifier, daily, for hours.

## Layout — three panes

```
┌──────────────┬────────────────────────────────┬──────────────┐
│ Queue        │ Evidence                       │ Findings     │
│ 280px        │ flexible                       │ 360px        │
│              │                                │              │
│ severity-    │ before / after comparison      │ findings,    │
│ sorted list  │ synced zoom and pan            │ HIGH first   │
│              │                                │              │
│ j / k        │ EXIF + boundary map below      │ each expands │
│              │                                │ to inputs    │
│              │                                │              │
│              │                                │ ────────────│
│              │                                │ decision     │
│              │                                │ + reason     │
└──────────────┴────────────────────────────────┴──────────────┘
```

## Queue pane

Only submissions the caller's organisation is assigned to and did not
originate. `HIGH` findings sort to the top — a reviewer's attention is the
scarcest resource in the system, so spend it on the riskiest cases first.

Each row: project, submitted time, finding count by severity, current status,
and whether this user has already decided.

**`ESCALATED` items.** A verifier administrator sees escalated submissions
pinned to the top of their queue, above the severity ordering. Other
verifiers see them as ordinary rows, marked as awaiting a deciding vote.

## Evidence pane

`EvidencePair` with a comparison slider and synced zoom and pan. Below it, the
EXIF panel and the boundary map with the EXIF point plotted.

A reviewer's core act is comparing two photographs. Make that excellent and
the rest follows.

## Findings pane

`FindingCard` per finding, severity-ordered, each expanding to the literal
inputs (C3). Then the `DecisionForm`.

## The decision form

Three actions. A mandatory reason. The approve button is **disabled until the
reason has content** — not an alert after the fact.

No "are you sure?" dialog. Typing *why* is a better guard than clicking *yes*,
and it leaves an artefact a funder can read.

After a decision: auto-advance to the next item, with a brief undo window
**before** the write commits. Once written, a decision is permanent — there is
no edit, because `review_decision` is append-only.

## Keyboard

`j` / `k` move · `Enter` open · `a` approve · `r` reject · `m` request more
proof · `/` focus filter · `?` shortcut sheet · `Esc` close.

**Every shortcut has a visible button.** Keyboard-only is an accessibility
failure, not a power feature.

## Quorum display

Show the tally explicitly: *"1 of 2 approvals · awaiting a second verifier"*.
On a 1/1 split, the submission is `ESCALATED` and the banner reads:
*"Split decision — awaiting a deciding vote from a verifier administrator."*
Never leave a reviewer guessing whether their decision concluded anything.

---

# 6 — `/projects/[id]/submit` Evidence intake

**Features:** A1, E2, C1 trigger.

**Who lands here.** A field worker, often on a phone, often with bad signal.

**The job.** Get evidence in reliably, including with no network.

## Layout — single column, mobile-first

This is the one page where mobile is the primary target, not a consideration.

1. Project context header — which project, its boundary thumbnail
2. Before capture — camera or file
3. After capture — camera or file
4. Per-image preview with the client-computed SHA-256 shown as it is computed
5. Optional note
6. Optional device location, labelled *weak signal*
7. Submit — runs `submissions.finalize` (see *Draft and direct upload*)
8. **Offline queue**, when anything is pending

## Client-side hashing

Hash on selection, display it, send it as `client_sha256`. Label it in the UI:
*"computed on your device — the server will recompute from the stored file"*.

Showing the hash forming is the first moment a field worker sees that this
system takes their evidence seriously.

## Draft and direct upload

Files do not travel through a Server Action. The page works against a `DRAFT`
submission:

1. `submissions.createDraft` returns the submission id; its status is `DRAFT`.
2. Each file goes **directly from the browser to private blob storage** with a
   scoped upload token (allowed MIME types, 5 MB).
3. Submit calls `submissions.finalize`, which verifies the files, hashes the
   stored bytes on the server and moves the submission to
   `PENDING_FORENSICS`.

Show upload state per file, so a dropped connection costs one file, not the
whole submission. The server's hash is authoritative; the client hash shown on
this page is only a convenience. A `DRAFT` with no files is swept after 24
hours. See `docs/01-FEATURE-LOCK.md` §State machine.

## Offline (E2)

If the network is down, the form still works. Bytes, hash and metadata go to
IndexedDB and a queue card appears with a clear per-item state. Sync on
reconnect with visible progress.

**Never silently drop a queued submission.** A field worker who loses a day's
captures does not come back.

## Validation

Both images required. 5 MB each. MIME sniffed from bytes, not from the
extension. Errors appear inline next to the control, never as a toast that
disappears before it is read.

---

# 7 — `/submissions/[id]` Submission detail

**Features:** C1, C3, A3 read, B3 read.

**Who lands here.** An owner checking why their submission was rejected. A
verifier reviewing outside the queue flow.

**The job.** The full record of one submission, with nothing hidden from
someone entitled to see it.

Sections: status with quorum tally · evidence pair with both hashes · all
findings with drill-down · EXIF panel · boundary map · decision history with
reasons · audit trail for this submission · anchor status if approved.

For an owner whose submission was rejected, this page is the explanation.
Make it complete and make the reasons prominent. A rejection without a
readable reason is the fastest way to lose an honest organisation.

---

# 8 — `/dashboard` Role-aware home

**The job.** Answer "what needs me?" in under three seconds.

One page, three shapes by `org_type`:

| Org type | Shows |
|---|---|
| `OWNER` | Submissions needing more proof (first — it is actionable), projects, recent decisions, approved-and-anchored count |
| `VERIFIER` | Queue depth by severity, assigned projects, your recent decisions, splits awaiting a third verifier |
| `FUNDER` | Verified outcomes, recently anchored records, projects by organisation |

**Every number is computed from the database at request time.** No animated
counters, no sparklines of invented data, no trend arrows you did not measure.
A dashboard with one real number beats one with eight fabricated ones.

The most actionable item goes top-left. For a verifier that is the queue; for
an owner it is anything blocked on them.

---

# 9 — `/projects/new` Project creation

**Features:** C4, D5.

Two steps. Metadata, then the boundary.

**Draw the boundary on a map.** Never ask a user to type coordinates — it is
error-prone, and a typo here silently breaks every geospatial check for the
project's lifetime.

Show the enclosed area in hectares as they draw. Set the tolerance in metres
with a visible buffer ring on the map, so the number has meaning.

On save, generate the salt and the commitment server-side.

---

# 10 — `/admin` Operations

**Features:** E3, E4, A3 verification, B1 assignment.

**Admin is an operations role, not a trust role.** An admin cannot approve a
submission, override a quorum, or alter an audit row. The page should make
that boundary obvious by containing no such controls.

Sections: job queue health with stuck jobs and a retry button · anchor status
with "Anchor now" · verifier assignment · organisation management · audit
chain verification · `matchRef` resolution (which writes an audit event
naming the admin).

`DEMO_MODE` only: the tamper demo.

---

# 11 — `/sign-in`, `/sign-up`, `/demo`

Layout, interaction and states are in `docs/15-UI-STATES.md` §6.

---

# Cross-page rules

1. **One primary action per page**, in signal lime. If two things compete,
   neither reads as primary.
2. **Paper pages never go dark. Field pages never go light.** No theme toggle
   — the theme follows the audience.
3. **Server Components by default.** `"use client"` only for the map canvas,
   the uploader, the drop-photo verifier, and the keyboard queue.
4. **Every dynamic route handles not-found explicitly.** A crash page on a
   proof link is a trust failure.
5. **Hashes are monospace with tabular numerals, everywhere.** Full length
   where someone might verify, truncated with hover and copy in tables.
6. **Every page that can be empty has a designed empty state.** See
   `docs/15-UI-STATES.md` §2.
7. **The limits statement appears on `/`, `/about` and every `/proof/[id]`.**
   Verbatim, not paraphrased.
8. **No page shows a number it did not compute.**
