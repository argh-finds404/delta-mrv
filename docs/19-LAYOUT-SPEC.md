# 19 — Layout Specification

**Authority: hard numbers for proportion, measure, rhythm and interaction.
Overrides any pane width or spacing implied elsewhere.**

Written after reviewing the built Lab. The visual correction in doc 18 fixed
colour and density. This fixes geometry — the part no document specified, so
every agent guessed.

---

## 1. The rule that was missing

> **No column of prose is ever narrower than 45 characters, or wider than 75.**

The built Lab has a findings column about 20 characters wide. Text that
narrow is physically slower to read — the eye makes a return sweep every
three words — and it makes correct content look broken.

Set it in CSS and never override it:

```css
.prose-column { max-width: 68ch; min-width: 45ch; }
```

If a pane cannot hold 45 characters at its assigned width, **the pane is too
narrow and the layout is wrong**, not the text.

---

## 2. Evidence Lab geometry

### Pane widths

| Pane | Width | Behaviour |
|---|---|---|
| Queue | `clamp(260px, 22vw, 320px)` | Fixed; truncates titles with ellipsis |
| Evidence | `1fr`, min 480px | Takes all remaining space |
| Findings | `clamp(380px, 28vw, 460px)` | Fixed; **must hold 45ch after padding** |

```css
grid-template-columns: clamp(260px,22vw,320px) minmax(480px,1fr) clamp(380px,28vw,460px);
```

Below 1280px the findings pane moves beneath the evidence pane, full width.
Below 1024px the Lab is read-only with a "open on a larger screen to decide"
notice, as doc 14 already says.

### Internal padding

Every pane: `20px` horizontal, `16px` vertical. Cards inside a pane:
`16px`. Nothing uses less than `12px` against an edge.

At 380px with 20px pane padding and 16px card padding, the text column is
308px — about 48 characters at 15px. That clears the floor with nothing
spare, which is why the pane cannot go narrower.

### The evidence pane dominates

The comparison is the reviewer's core act. The image area gets **at least
60% of the pane's height**, and the controls above it are a single 40px row.
Capture metadata and hashes live in a collapsed strip at the bottom — one
32px row when closed.

---

## 3. FindingCard — tier 1 is two lines, not six

The current card puts the distance, the threshold and a fraud assessment in
tier 1. All of that is tier 2.

**Tier 1 renders exactly this and nothing more:**

```
● Matches another organisation's evidence
  Very close visual match — 5 of 64 bits differ.
```

Line one: 15px, `--field-text`, the plain-language label. Line two: 13px,
`--field-muted`, one sentence stating the magnitude in words a non-specialist
reads. No threshold. No rule version. No "high fraud risk" editorialising —
the severity dot already says that.

Collapsed card height: **64–80px.** If a card is taller than 80px when
closed, tier 2 content has leaked in.

Four collapsed cards must fit in the findings pane without scrolling. That
is the test: can a reviewer see every finding on a submission at a glance?

**Tier 2** holds the four-row table: distance, threshold, scope, rule
version. **Tier 3** holds the bit grids and full hashes.

---

## 4. Vertical rhythm

One scale, used everywhere. No other values.

```
4  8  12  16  24  32  48  64
```

| Relationship | Gap |
|---|---|
| Label to its own value | 4 |
| Within a card | 12 |
| Between cards in a list | 8 |
| Heading to its content | 16 |
| Between sections | 48 |
| Page top to first content | 32 |

A heading sits closer to the content it introduces than to the section above
it. The current build spaces them evenly, so headings appear to float
between blocks rather than belong to one.

---

## 5. Typography corrections

**Caption text is sentence case.** `BEFORE CAPTURE · T1 RE-SURVEY` becomes
`Before capture · T1 re-survey`. Doc 18 §2 already required this and it was
missed in image captions.

**Monospace only on values.** A caption describing an image is prose. A
coordinate inside it is a value. Mix within the line:

```
Before capture · 12 Mar 2024 · 21.9497° N, 89.1833° E
└── sans ──────────────────┘   └──── mono ─────────┘
```

**Raw JSON never ships.** The Atlas filter bar prints
`{"activityType":"All",…}`. That is debugging output. Acceptable in the
kitchen sink behind a "dev state" toggle; nowhere else.

---

## 6. Queue pane — make it feel like a queue

The current list reads as static rows. Four changes:

**Selected row** gets a 2px `--field-muted` left border, `--field-raised`
background, and no other decoration. One selected row at a time.

> **Decided 2026-11-03: the border is neutral, not `--signal`.** An earlier draft
> used `--signal`, which put a second lime element on the screen next to the
> primary action and broke the "one accent per screen" rule of doc 18. Doc 18 wins.
> `--signal` on this screen is exactly two things: the Approve button, and the
> transient keyboard focus ring below. Do not reintroduce it on selection.

**Hover** lifts to `--field-raised` with a 120ms background transition. No
transform, no shadow.

**Keyboard focus** is distinct from selection — a 2px `--signal` outline with
2px offset. A reviewer arrowing through the queue sees focus move before they
press Enter.

**Row height is fixed at 72px.** Title on line one, truncated with ellipsis.
Second line holds the timestamp and one severity summary chip. Variable-height
rows make `j`/`k` navigation feel unpredictable because the list jumps.

### The slide-over

Where a drawer or panel slides in, it animates `transform: translateX()` only,
`220ms`, `cubic-bezier(0.2, 0, 0, 1)`. It never animates `width` — that
reflows the whole layout every frame and feels sticky, which is probably what
reads as "simple" in the current build.

---

## 7. The comparison slider

The current implementation has the Before and After pills overlapping the
caption text beneath them. Rebuild:

- **Handle**: a 4px vertical line in `--field-text` at 60% opacity, with a
  32px circular grab target centred on it. The target is invisible until
  hover, then `--field-raised` at 90%.
- **Labels**: `Before` and `After` pinned to the top-left and top-right
  corners of the *image area*, 12px, inside an 8px padded pill at
  `--field-abyss` 70%. They never overlap caption text because the caption
  sits below the image, outside its box.
- **Drag**: pointer events on the whole image area, not just the handle.
  Clicking anywhere jumps the divider there.
- **Keyboard**: arrows step 2%, shift+arrows step 10%, Home and End jump to
  the extremes.
- **Zoom**: a single control. Both images share one transform so they stay
  registered.

---

## 8. Checklist

- [ ] No prose column narrower than 45ch at any breakpoint
- [ ] Collapsed `FindingCard` is 64–80px tall
- [ ] Four collapsed findings fit without scrolling
- [ ] Every gap is from the 4/8/12/16/24/32/48/64 scale
- [ ] Headings sit nearer their content than the section above
- [ ] No ALL CAPS, including image captions
- [ ] No raw JSON outside the kitchen sink
- [ ] Queue rows are a fixed 72px
- [ ] Panels animate `transform`, never `width`
- [ ] The slider handle has a 32px grab target
- [ ] Image area is at least 60% of the evidence pane's height
