# 16 — Amendments v2

Authority: **this file overrides the documents it names.** Where a numbered
doc and this file disagree, this file wins until the numbered doc is edited
to match.

**Date:** 2026-11-02
**Source:** external review of the v1 doc set. Accepted items only; rejected
items are listed in §B so they do not come back.

---

# A. Accepted amendments

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

## A14 — No email, and say so

**Amends:** `docs/07-DEPENDENCIES.md` §6, `docs/04-AUTH.md`.

Zero-cost means no transactional email provider. Therefore:

- Invitations are **copyable links** with a role and an expiry, shown once.
- No email verification. No password reset by email.
- Alerts are in-app lists and webhooks.

State this plainly on `/trust` as a stated limitation of the demonstration
build rather than letting someone discover a dead "forgot password" link.

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
migration:** none remain. A2, A3, A5, A9, A12 and A15 have been applied to
the numbered documents.
