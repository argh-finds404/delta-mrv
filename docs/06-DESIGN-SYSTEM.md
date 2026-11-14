# 06 — Design System

Authority over: colour, type, space, motion, components, interaction.

> **Read this before writing any CSS or any component.** The visual language
> is a product decision, not a preference. It is what separates this from the
> thousand generated dashboards it would otherwise look like.

---

## 1. Design thesis

Delta has two audiences with opposite needs, so it has two themes — chosen by
**audience**, not by a toggle.

**Field** — the authenticated workspace. Dark, dense, instrument-panel. Built
for a verifier who stares at it for six hours comparing photographs. Calm
surfaces, precise numbers, colour reserved for state.

**Paper** — the public proof dossier. Light, warm, typographic, generous.
Built for a funder, a journalist or a stranger reading one page once. It
should feel like a certificate, because that is what it is.

Nothing crosses over. The workspace is never light. The proof page is never
dark.

## 2. Colour

### 2.1 Field tokens

```css
--field-abyss:    #0C1413;  /* page background */
--field-canopy:   #14201E;  /* cards, panels */
--field-raised:   #1C2B28;  /* hover, raised surfaces, inputs */
--field-hairline: #273A36;  /* borders, dividers */
--field-text:     #E8EDE9;  /* primary text */
--field-muted:    #8CA39C;  /* secondary text, labels */
--field-inert:    #5B6D68;  /* disabled, placeholder */
```

### 2.2 Semantic tokens — shared meaning in both themes

```css
--signal:   #D7F6B8;  /* primary action. ONE per screen */
--verified: #3E9D80;  /* a hash matched, a check passed */
--chain:    #7C8CF8;  /* on-chain state. The ONLY place chain language lives */
--review:   #E8A33D;  /* a human must look at this */
--fraud:    #E2644F;  /* high-severity finding */
```

### 2.3 Paper tokens

```css
--paper:       #F7F3EA;  /* page */
--paper-card:  #FFFDF8;  /* raised card */
--paper-rule:  #DED6C6;  /* hairline, dividers */
--paper-ink:   #1B1D1A;  /* primary text */
--paper-muted: #5E6460;  /* secondary text */
--paper-seal:  #1F6B55;  /* verified, on paper */
--paper-chain: #4A4FA8;  /* on-chain, on paper */
```

### 2.4 The colour rule

**Colour encodes state. Never hierarchy, never decoration.**

| Token | Used only for |
|---|---|
| `--signal` | The single primary action on a screen. Submit. Approve. Anchor now. |
| `--verified` | Hash matched, check passed, GPS inside boundary |
| `--chain` | Anchored, batch confirmed, Merkle proof valid |
| `--review` | Pending, `NEEDS_MORE_PROOF`, `MEDIUM` finding, `UNAVAILABLE` |
| `--fraud` | `HIGH` finding, `MISMATCH`, rejected |

If you cannot name the state a colour represents, use a neutral surface.

Never use colour as the only encoding. Every state carries an icon or a text
label as well — colour-blind users and printed pages both need it.

Severity badges:

| Severity | Field | Paper |
|---|---|---|
| `INFO` | `--field-muted` text, `--field-raised` fill | muted |
| `LOW` | `--field-inert` | muted |
| `MEDIUM` | `--review` | amber ink |
| `HIGH` | `--fraud` | red ink |

## 3. Typography

```
Newsreader   — Paper theme headings and body. Serif. The certificate voice.
Geist        — Field theme UI. All interface text.
Geist Mono   — every hash, coordinate, distance, duration, block number, count.
```

Loaded via `next/font/google`. Self-hosted automatically, no layout shift, no
render-blocking link tags.

### 3.1 The monospace rule

Every number a user might compare, copy or verify renders in `Geist Mono`
with `font-variant-numeric: tabular-nums`. Hashes, coordinates, Hamming
distances, metres, timestamps, block numbers, p95 latencies.

A hash in a proportional font is unreadable and uncopyable. This is not a
style choice.

### 3.2 Hash display

- Full 64 characters in the dossier and the Lab detail. Never truncated where
  someone might verify it.
- Truncated as `a3f2e8c1…94d7b206` in tables and lists only, with the full
  value on hover and a copy button.
- Monospace, `letter-spacing: 0.02em`, broken into visual groups where space
  allows.

### 3.3 Scale

Two weights only: 400 and 500. Never 600 or 700 — heavy weights are the
single loudest tell of a templated interface.

| Role | Size / line height |
|---|---|
| Display (Paper hero) | 44 / 1.15, Newsreader 400 |
| H1 | 28 / 1.25, 500 |
| H2 | 20 / 1.35, 500 |
| H3 | 16 / 1.4, 500 |
| Body | 15 / 1.6, 400 |
| Small / label | 13 / 1.5, 400, `--muted` |
| Mono data | 13 / 1.5, tabular |

Sentence case everywhere. Never Title Case. Never ALL CAPS, including labels
and badges — `letter-spacing` on uppercase micro-text is a dated tell.

## 4. Space and shape

4 px base unit. Use `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. Nothing else.

```css
--radius-sm: 4px;   /* badges, inputs, small controls */
--radius:    8px;   /* buttons, fields */
--radius-lg: 12px;  /* cards, panels */
```

Never a radius above 12 px except on an intentional pill. Never a fully
rounded card.

Borders are **1 px hairlines**, never 2 px. Depth comes from surface value
shifts (`abyss → canopy → raised`), never from shadows.

## 5. Hard prohibitions

These produce the look being avoided. None of them appear anywhere in the
application.

- **No glowing orbs.** No radial-gradient blobs behind the hero, no aurora
  mesh, no animated blur shapes.
- **No gradients** except a single two-stop linear gradient to show a genuine
  continuous physical quantity on a map legend.
- **No glassmorphism.** No `backdrop-filter: blur()`.
- **No glows.** No `box-shadow` used as a light source, no neon, no
  `filter: drop-shadow` on text.
- **No shadows for elevation.** Surface value only.
- **No fake metrics.** No animated counters, no sparklines of invented data,
  no "trusted by" logos, no uptime badge you do not measure.
- **No decorative charts.** Every chart renders real seeded data or it is
  deleted.
- **No emoji** in product UI.
- **No stock photography.** No illustrated people, no hand-drawn leaf motifs,
  no isometric abstractions.
- **No "blockchain" above the fold.** The landing page hero says *anyone can
  check it*. The chain is an implementation detail and lives in one section.
- **No centred body text** beyond the hero paragraph.
- **No full-width hero with a centred headline and two buttons.** That exact
  layout is the generated-landing-page signature. Use an asymmetric split
  with the real proof artefact visible on the right.
- **No spinner** where a skeleton matching the final layout will do.
- **No toast** for an action whose result is visible on the page.

## 6. Motion

Motion exists to explain, never to decorate.

Permitted, each because it carries meaning:

| Animation | What it explains |
|---|---|
| Finding rows streaming into the Lab as jobs complete | work is happening now |
| Merkle proof path illuminating node by node during verification | how the proof is checked |
| Drop-photo hash comparing character-group by character-group, settling green | the comparison is real, not asserted |
| Queue advancing after a decision | your action landed, here is the next one |
| Skeleton → content crossfade | the shape was predicted correctly |
| A check's results arriving one by one (`.step-arrive`) | each step was run, in this order |
| An icon drawing its mark once as it appears (`DrawnIcon`, 360 ms) | this result just happened |
| A stroke running along a curve (`CurveLoader`) while a check is in flight | work is under way and has not stalled |

Rules:

- `transform` and `opacity` only. Never animate layout properties.
- Duration 120–240 ms for state changes, up to 600 ms for an explanatory
  sequence. Nothing longer.
- Easing: `cubic-bezier(0.2, 0, 0, 1)` for entrances,
  `cubic-bezier(0.4, 0, 1, 1)` for exits.
- Every animation sits inside
  `@media (prefers-reduced-motion: no-preference)`. The reduced-motion path
  is the default and must be fully functional.
- Nothing loops. No pulsing, no breathing, no infinite shimmer. Two exceptions, both the
  maintainer's: the landing hero (2026-11-11, with a pause control), and an activity indicator
  (`CurveLoader`, spinners) while a check is actually in flight (2026-11-14), which stops when
  the work does and stands still with reduced motion.
- Empty frames waiting for content (a map not loaded yet, a drop zone) show the hairline dot
  grid, `.pattern-dots`, not a blank box.

## 7. Components

Built from `shadcn/ui` primitives generated by the CLI into
`src/components/ui/`. Restyled to these tokens; never used with default
styling.

### Delta-specific components

**`FindingCard`** — the most important component in the product.
Severity stripe, finding kind, human reason, and an expandable drawer showing
the literal `evidence` jsonb: the two images, both dHash bitstrings, the
Hamming distance, the threshold, the rule version. A reviewer must be able to
recompute the verdict by hand from what is on screen.

**`HashDisplay`** — monospace, grouped, copy button, full/truncated variants.

**`VerificationBadge`** — `MATCH` / `MISMATCH` / `PENDING` / `UNAVAILABLE`.
Icon plus text plus colour. Never colour alone.

**`EvidencePair`** — before/after with a draggable comparison slider, synced
zoom and pan, and per-image EXIF panels.

**`BoundaryMap`** — MapLibre canvas. Receives geometry from the server and
renders what it is given. It never decides fuzzed versus exact.

**`DecisionForm`** — three actions, mandatory reason, disabled until the
reason has content, undo window before commit.

**`ChainAnchorPanel`** — chain id, contract, tx hash to BaseScan, block,
root, leaf index, proof path.

## 8. Interaction principles

1. **Explain every flag.** No finding appears without a reason a human wrote
   and inputs a human can inspect.
2. **Never block on an optional service.** AI unavailable is a neutral state,
   not an error banner.
3. **Keyboard parity.** Every mouse action in the Lab has a keyboard path;
   every keyboard shortcut has a visible control.
4. **Destructive actions are reasoned, not confirmed.** Instead of "are you
   sure?", require the reason field. Typing why is a better guard than
   clicking yes.
5. **Empty states teach.** An empty Lab queue explains what will appear here
   and why it is empty, and links to the demo data.
6. **Errors name the system and the next step.** "Gemini quota exhausted —
   the AI finding will be retried on the next drain. Forensics completed
   normally."

## 9. Accessibility floor

- WCAG AA contrast on both themes. Verify `--signal` on `--field-abyss` and
  every severity token on its fill. Fix the token, do not waive the check.
- Visible focus rings everywhere. Never `outline: none` without a replacement.
- Hit targets 44×44 px minimum on touch.
- All imagery has meaningful alt text; evidence photographs describe the
  project and capture time.
- The whole application is operable by keyboard.
- `prefers-reduced-motion` is honoured.
- Tested at 320 px width and at 200 % zoom.

## 10. Responsive

Mobile is the field worker's device. The submit flow and the proof dossier
must be excellent on a phone. The Lab is desktop-first and may show a
"best on a larger screen" notice below 900 px — but it must still function.

Breakpoints: `640 / 900 / 1280`. Content-driven, not device-driven.
