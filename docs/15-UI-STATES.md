# 15 — UI States

Authority over: empty, loading, offline, progress, error and auth states.

> **Why this document exists.** The happy path is maybe 30% of the time a
> person spends in an application. The rest is waiting, arriving somewhere
> empty, losing signal, or hitting something that went wrong. Interfaces feel
> cheap because these states were an afterthought. In Delta they are specified
> before the happy path is built.

---

## 1. The state model

Every data-driven surface has exactly six states. Design all six before
building the component.

| State | Condition | Never show |
|---|---|---|
| **Loading** | Data in flight, nothing cached | A spinner where a skeleton fits |
| **Empty — never** | Query succeeded, zero rows, user has not acted yet | "No data" |
| **Empty — filtered** | Zero rows because of a filter | The same copy as empty-never |
| **Populated** | Data present | |
| **Error** | Request failed | A raw stack trace or an error code alone |
| **Offline** | No network | An error. Offline is a *mode* here, not a failure |

The two empty states are different states, not one. Conflating them is the
most common emptiness mistake: a new user and a user whose filter excluded
everything need completely different sentences.

---

## 2. Empty states

### The rule

An empty state has three parts, in this order:

1. **What this space is for** — one sentence, present tense
2. **Why it is empty right now** — specific to the actual reason
3. **One action, or an honest statement that there is nothing to do**

Never an illustration. Never a shrugging character. Never "No data found."
Never an exclamation mark.

The empty state is often a user's first sight of a feature, so it is teaching
material, not an apology.

### Per-surface copy

**`/lab` — no assignments**

> **Your review queue**
> Your organisation is not assigned to any projects yet. A platform
> administrator assigns verifier organisations to the projects they audit.
> *[Contact support]*

This is the hardest empty state in the product, because the user cannot fix
it themselves. Say that plainly rather than offering a dead-end action.

**`/lab` — assigned, queue clear**

> **Queue clear**
> Nothing is awaiting your review. New submissions appear here automatically
> once forensic processing completes.
> *Last reviewed 14 minutes ago.*

A cleared queue is an achievement. Say so quietly. Resist the urge to
celebrate with a graphic.

**`/lab` — filtered to nothing**

> **No submissions match these filters**
> 23 submissions are in your queue. None are `HIGH` severity.
> *[Clear filters]*

Always state how many exist unfiltered. That number is what tells the user
their filter is the problem, not the data.

**`/dashboard` — owner, no projects**

> **No projects yet**
> A project defines a restoration site, its boundary, and what you are
> claiming. Evidence is submitted against a project.
> *[Create your first project]*

**`/projects/[id]` — no submissions**

> **No evidence submitted yet**
> Evidence is a before and after photograph pair. Once submitted, it runs
> through forensic checks and then independent review.
> *[Submit evidence]* — owners only. Others see the sentence without a button.

**`/atlas` — no projects in view**

> **No projects in this area**
> Delta currently has projects in the Sundarbans, Sylhet, Dhaka and Cox's
> Bazar.
> *[Reset view]*

Naming where the data *is* beats telling someone where it isn't.

**`/admin` — queue healthy**

> **Queue healthy**
> No pending, failed or stuck jobs. Last drained 4 minutes ago.

**Findings pane — no findings**

> **No findings**
> All seven deterministic checks completed and none produced a finding. This
> submission still requires independent review.

That last sentence is essential. A clean forensic result must never read as
pre-approval — it is exactly the moment a careless reviewer rubber-stamps.

---

## 3. Loading states

### Skeletons, not spinners

A skeleton that matches the final layout means the page does not reflow when
data arrives. A spinner tells the user nothing and then jolts them.

**Rules**

- Skeleton shapes match the real content's dimensions. A three-line card
  skeleton for a three-line card.
- Surface `--field-raised`, no shimmer animation. Shimmer is decorative
  motion and it flickers during streaming.
- Never skeleton a container whose size you do not know. Skeleton the rows,
  not the page.
- Crossfade skeleton → content at 120 ms. No slide, no scale.
- Below ~200 ms, show nothing. A flash of skeleton is worse than a brief
  blank.

### Where a spinner *is* correct

Only inside a button whose action is in flight, and only with the label
changed:

```
[ Approve ]  →  [ ⟳ Recording decision ]   (disabled)
```

The label change carries the information. The spinner just indicates
liveness.

### Per-surface skeletons

| Surface | Skeleton |
|---|---|
| `/lab` queue | 8 rows: title bar, meta line, three severity pills |
| Evidence pane | Two 4:3 blocks side by side, caption bars beneath |
| Findings pane | 3 cards: severity stripe, headline bar, two meta lines |
| `/atlas` | Map chrome and filter pills render immediately; the canvas fades in. **Never skeleton a map** — the container is the right shape already |
| `/proof/[id]` | Header text, then a verification-badge placeholder. The static record renders server-side; only verification is pending |
| `/dashboard` | Tile grid at final dimensions, numbers as bars |
| Hash values | A 64-character monospace block of `--field-raised` — exactly the final width, so nothing shifts |

### Streaming

Use Suspense boundaries per section, not one around the page. On `/lab` the
queue should arrive before the evidence pane; a reviewer can start reading
immediately.

Order boundaries by what the user needs first, not by what resolves fastest.

---

## 4. Progress — the forensic pipeline

This needs its own treatment. The pipeline takes 5–20 seconds across seven
stages, and "Processing…" for fifteen seconds feels broken.

### Show the stages

```
Evidence received
  ✓ Stored and hashed                      sha256 a3f2…b206
  ✓ Perceptual hash computed               dhash 64 bits
  ✓ Duplicate search                       1 finding
  ✓ Metadata extracted                     GPS present
  ⟳ Boundary check
  ○ Change detection
  ○ Advisory observation                   optional
```

**Why this works.** The user learns what the system actually does while they
wait. The wait becomes the explanation. And a stage that produces a finding
shows it immediately, so a `HIGH` duplicate is visible before the run
finishes.

### Implementation

- Each job stage writes its status; the client polls or subscribes.
- Completed stages show their result inline, in monospace where it is a value.
- The current stage has the only animation on the page.
- Pending stages are `--field-inert`, no animation.
- A failed stage shows `✕` with its reason and the pipeline **continues**.
- The optional AI stage is labelled optional before it runs, so
  `ai_unavailable` is not a surprise.

### Progress honesty rules

- **No fake progress bars.** You do not know the percentage. Discrete stages
  are honest; a bar sliding to 90% and stopping is a lie.
- **No estimated time remaining** unless you measured it.
- If the pipeline exceeds 60 seconds, say so and keep the page usable:
  *"Still processing. You can leave this page — the submission is saved and
  you will see it in your dashboard."*

### Long operations elsewhere

| Operation | Treatment |
|---|---|
| Anchoring a batch | Stages: building tree → writing proofs → submitting → awaiting confirmation. The last can take minutes; show the tx hash as soon as it exists so the user can watch the explorer themselves |
| Seeding 5,000 rows | CLI progress, not a UI concern |
| Browser proof verification | Three stages: fetching manifest → recomputing hash → querying chain. Sub-second, but showing the steps is what makes it credible |

---

## 5. Offline

**Offline is a supported mode in Delta, not an error.** A field worker in the
Sundarbans has no signal. That is the normal case for the submit flow.

### Global indicator

A persistent bar, not a toast, below the header:

```
○ Offline — 2 submissions queued           [View queue]
```

Toasts disappear. Offline persists. The indicator must too.

On reconnect, it changes state rather than vanishing silently:

```
● Back online — syncing 2 submissions…
```

### Per-surface behaviour

| Surface | Offline |
|---|---|
| `/projects/[id]/submit` | **Fully functional.** Capture, hash and queue locally. Primary action becomes "Queue for upload" |
| Offline queue card | Each item: thumbnail, project, client hash, state (`queued` / `uploading` / `failed, will retry` / `uploaded`), and a manual retry |
| `/lab` | Read-only for cached submissions. Decision form disabled with: *"A decision needs a connection — it is recorded with a cryptographic audit entry."* Never let a decision queue offline: the audit chain requires a serialised server-side append |
| `/atlas` | Cached tiles and last-loaded projects, with a staleness note |
| `/proof/[id]` | Static record from cache. Verification shows `UNAVAILABLE`, never `MISMATCH` |
| `/dashboard` | Cached counts with "as of HH:MM" |

### The decision rule

**Evidence capture queues offline. Review decisions do not.**

A queued decision would need its audit-chain hash computed against a chain
head that may have moved. Explain this to the user in one sentence rather
than silently disabling a button.

### Implementation

1. Service worker caching the shell, the submit route, and recently viewed
   submissions.
2. `navigator.onLine` plus a lightweight heartbeat — `onLine` reports true on
   a captive-portal network with no real connectivity.
3. IndexedDB for the queue: bytes, client hash, metadata, state, attempts.
4. Sync on the `online` event with exponential backoff and visible per-item
   status.
5. **Never auto-clear a failed item.** It stays until the user acts.

---

## 6. Authentication pages

**The job.** Get a returning user in without friction, and get a new
organisation registered with its type correctly set.

**The trap.** A centred card on a gradient background with a glowing orb
behind it. Every generated auth page looks like that.

### Layout — asymmetric split

```
┌────────────────────────────┬──────────────────────────────┐
│                            │                              │
│  Delta                     │   Sign in                    │
│                            │                              │
│  A live record             │   Email                      │
│  ───────────────────       │   [                      ]    │
│  Sundarbans Corridor       │                              │
│  ✓ anchored                │   Password                    │
│  a3f2e8c1…94d7b206         │   [                      ]    │
│  2 independent approvals   │                              │
│                            │   [ Sign in ]                │
│  3,100 records verified    │                              │
│                            │   New organisation? Register  │
│  [ Open this record ]      │   Just looking? Try the demo  │
│                            │                              │
└────────────────────────────┴──────────────────────────────┘
```

**Left, 45%:** `--field-canopy`. A real anchored record from the seeded
database — project, verification badge, truncated hash in monospace, approval
count. One real total. It links out to the public proof dossier.

Showing the product working on the sign-in page is worth more than any
tagline, and it costs one query.

**Right, 55%:** `--field-abyss`. The form, vertically centred, max-width
400px.

On mobile the left panel collapses to a single line above the form. It does
not stack as a tall hero — that pushes the form below the fold, which is the
only thing on the page that matters.

### Form interaction

| Detail | Rule |
|---|---|
| Autofocus | Email on sign-in. Nothing on mobile — the keyboard covering the form is worse than one tap |
| Labels | Above the field, always visible. Never placeholder-as-label: it vanishes on focus and breaks autofill |
| Autocomplete | `email`, `current-password`, `new-password`. Getting these right is the single biggest usability win on an auth form |
| Validation | On blur for format, on submit for everything. **Never on keystroke** — validating an email as it is typed shows an error the user is already fixing |
| Errors | Inline, below the field, 13px `--text-danger`, with the field border in danger. Cleared on edit |
| Submit | Label changes to `⟳ Signing in`, button disabled, form fields stay readable |
| Failed sign-in | *"Email or password is incorrect."* Never say which — that confirms whether an account exists |
| Password visibility | A toggle, always. Hiding a password the user is typing on a phone causes more failures than it prevents |
| Enter | Submits from any field |
| Caps Lock | If detected on the password field, a quiet note |

### Sign-up — two steps, not one long form

**Step 1 — you.** Name, email, password. Password strength shown as a
four-segment bar with specific guidance (*"add a few more characters"*), never
a scolding list of unmet rules.

**Step 2 — your organisation.** Name, country, website, and **organisation
type**.

The type selector is the most consequential field in the product and must not
be a dropdown. Three cards, one line each:

| | |
|---|---|
| **Project owner** | You run restoration projects and submit evidence |
| **Independent verifier** | You review other organisations' evidence |
| **Funder** | You fund projects and review verified outcomes |

Below them, in muted text:

> Organisation type determines what you can do. A project owner cannot review
> evidence, including its own. This cannot be changed later without
> administrator approval.

Say it at the point of decision. A user who picks wrong here is blocked from
the thing they came for, and the rule that stops them is the core of the
product.

### `/demo` — role switcher

Four cards, each signing into a real seeded session. No password field, no
pretend login.

Each card: role, organisation, and one line on what to try.

> **Independent verifier one** · Delta Independent Audit
> Review a queue with a flagged duplicate, then approve.
> *Note: approval needs two verifiers. Sign in as verifier two afterwards to
> complete it.*

That note is the difference between a visitor experiencing the quorum rule
and a visitor thinking the approve button is broken.

Above the cards, the six-step demo path from
`docs/11-IMPLEMENTATION.md` §3, so a recruiter knows what they are looking
for before they start clicking.

---

## 7. Errors

### Message structure

Three parts: **what failed**, **what it means for their data**, **what to do
next**.

| Bad | Good |
|---|---|
| "An error occurred" | "Could not reach the database. Your submission was not saved. Try again in a moment." |
| "Request failed with status 500" | "Forensic processing failed for this image. The submission is saved and will be retried automatically." |
| "AI service unavailable" | "Advisory observation is not available for this submission. All forensic checks completed normally." |

The middle part matters most. The first question a user has after an error is
*did I lose my work?*

### Severity treatment

| Kind | Treatment |
|---|---|
| Field validation | Inline, below the field |
| Action failed, retryable | Inline near the action, with a retry |
| Optional service degraded | Neutral note, not red. `ai_unavailable` is not an error |
| Page-level failure | In-layout error state with the navigation intact. Never a blank page |
| Not found | Specific: *"No submission with that identifier, or you do not have access to it."* The ambiguity is deliberate — see `docs/04-AUTH.md` §5 |

### Never

- A toast for an error the user must act on. Toasts vanish.
- A red banner for a degraded optional service.
- A raw error code with no sentence.
- `MISMATCH` when the cause is an unreachable RPC.

---

## 8. Interaction polish

These are small and they are what separates a considered interface from a
generated one.

**Optimistic updates, carefully.** Filter and sort optimistically — they are
local and reversible. Never optimistically render a review decision as
recorded: it writes an audit-chain entry, and showing success before the
server confirms would be showing a lie.

**Focus management.** Opening a submission moves focus to its heading.
Closing returns focus to the row that opened it. A keyboard user who loses
their place has to start over.

**Undo over confirm.** After a decision, a brief undo window before the write
commits. One click to proceed, one chance to catch a mistake — better than a
dialog nobody reads.

**Copy feedback.** A hash copy button changes its icon for 1.5 seconds. No
toast. The feedback belongs where the action was.

**Tabular numerals everywhere.** Hashes, distances, counts, latencies.
Without `tabular-nums` a live count visibly jitters as digits change width.

**Scroll preservation.** Returning to `/lab` from a submission restores the
queue's scroll position.

**No layout shift.** Reserve space for anything that arrives late. A badge
appearing and pushing content down is the cheapest-looking thing an interface
can do.

**Respect reduced motion.** Every animation sits inside
`@media (prefers-reduced-motion: no-preference)`. The reduced path is the
default and must be fully functional, not degraded.

---

## 9. Build checklist

A surface is not done until all of these are true.

- [ ] Loading skeleton matches the populated layout's dimensions
- [ ] Empty-never state has purpose, reason and one action
- [ ] Empty-filtered state is distinct and states the unfiltered count
- [ ] Error state says what failed, what it means for their data, what next
- [ ] Offline behaviour is specified, and is not an error where offline is
      supported
- [ ] Any operation over 400 ms shows progress; over 5 s shows stages
- [ ] Focus is managed on open and close
- [ ] Keyboard path exists for every mouse action
- [ ] Nothing shifts layout when late data arrives
- [ ] Works at 320px and at 200% zoom
- [ ] Renders correctly with reduced motion
- [ ] No number on screen that was not computed
