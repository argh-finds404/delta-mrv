# 18 — Visual Correction v1

**Authority: this file overrides `docs/06-DESIGN-SYSTEM.md` §2, and adds a
density contract that §7 was missing.**

Written after reviewing the built Lab and kitchen sink. Two defects, both
originating in the specification rather than the implementation.

---

## The two defects

**1. Monochrome.** The three surface tokens were all desaturated green, and
the semantics were lime, green and teal on top. Every pixel in the workspace
shared one hue, so nothing read as distinct and the whole interface looked
tinted rather than designed.

**2. Everything at once.** Docs 14 and 15 specified *what appears on each
page* but never *what is primary, what is secondary, and what stays hidden
until asked for*. The result renders a finding as: severity badge, raw enum
name, prose paragraph, engine version, algorithm explanation, distance,
threshold, an 8×8 bit matrix and a hover hint — simultaneously, four times
over. A reviewer working through a hundred submissions cannot parse that.

---

## 1. Field palette v2 — replaces `06-DESIGN-SYSTEM.md` §2.1 and §2.2

### Surfaces — near-neutral

```css
--field-abyss:    #0A0C0B;  /* page background */
--field-canopy:   #121514;  /* cards, panels */
--field-raised:   #1A1E1C;  /* hover, inputs, raised */
--field-hairline: #262B29;  /* borders, dividers */
--field-text:     #E6E9E7;  /* primary text */
--field-muted:    #9AA3A0;  /* secondary text, labels */
--field-inert:    #646B68;  /* disabled, placeholder */
```

These carry roughly a 3% green cast — enough that the product has a
temperature, not enough to read as a colour. **The workspace chrome is
neutral. Colour belongs to state alone.**

### Semantics — five distinct hues

```css
--signal:   #C9F578;  /* primary action. ONE per screen */
--verified: #3DD6B0;  /* a hash matched, a check passed */
--chain:    #8B93FF;  /* anchored, on-chain */
--review:   #F0A93B;  /* a human must look */
--fraud:    #F2705C;  /* high-severity finding */
```

`--verified` moved from green to **teal**, specifically so it cannot be
confused with `--signal` lime. Two greens meaning two different things was
part of the original problem.

### The tint rule — this is what kills the colour blocks

**A semantic colour is never a solid fill behind text.**

Every badge, chip, pill and status block uses:

```css
background: color-mix(in srgb, var(--fraud) 14%, transparent);
border: 1px solid color-mix(in srgb, var(--fraud) 35%, transparent);
color: var(--fraud);
```

Plus a 4px filled dot in the same colour, so the state survives greyscale
printing and colour-blind vision.

Solid fills are permitted in exactly one place: the single primary action
button per screen, which is `--signal` fill with `--field-abyss` text.

### Paper palette — unchanged

`06-DESIGN-SYSTEM.md` §2.3 stands. The certificate theme was not the problem.

---

## 2. Density contract — new, extends §7

### The three-tier rule

Every information-dense component renders in three tiers. **Tier 1 is the
only tier visible by default.**

| Tier | Contains | Revealed by |
|---|---|---|
| **1 — Verdict** | One line a non-specialist understands. A severity dot and a sentence. | Always visible |
| **2 — Numbers** | The measured values and the threshold they were compared against | One click |
| **3 — Artefacts** | Raw material: bit grids, full hashes, EXIF dumps, rule versions | One more click |

A reviewer scanning a queue reads tier 1 only. A reviewer investigating one
case opens tier 2. A reviewer disputing a verdict, or demonstrating the
system, opens tier 3.

### Applied to `FindingCard`

**Tier 1 — always:**

```
● Matches another organisation's evidence
  Very close visual match — 5 bits different out of 64.
```

A dot in `--fraud`, a plain sentence, a second line in `--field-muted`.
Nothing else. No enum, no engine version, no threshold.

**Tier 2 — "Show the numbers":**

```
Perceptual hash distance   5
Flagging threshold         below 8
Match scope                a different organisation
Rule version               forensics.v1
```

A four-row definition list in monospace. That is all.

**Tier 3 — "Show the raw comparison":**

The two 8×8 bit grids with differing bits highlighted, both full 64-character
hashes, and the opaque match reference.

### Plain language, never enums

A database enum must never reach the screen. Map every one:

| Stored | Displayed |
|---|---|
| `PERCEPTUAL_MATCH_OTHER_ORG` | Matches another organisation's evidence |
| `PERCEPTUAL_MATCH_SAME_ORG` | Matches your organisation's other project |
| `PERCEPTUAL_MATCH_SAME_PROJECT` | Similar to an earlier photo in this project |
| `EXACT_DUPLICATE_OTHER_ORG` | Identical file already submitted elsewhere |
| `GPS_OUTSIDE_BOUNDARY` | Taken outside the project boundary |
| `GPS_WITHIN_TOLERANCE` | Just outside the boundary, within tolerance |
| `GPS_MISSING` | No location recorded in the photo |
| `EXIF_TIMESTAMP_MISSING` | No capture time recorded |
| `EXIF_TIMESTAMP_IMPLAUSIBLE` | Capture time does not fit the project dates |
| `EXIF_FULLY_STRIPPED` | All camera metadata removed |
| `NO_VISIBLE_CHANGE` | Before and after look nearly identical |
| `CLIENT_HASH_MISMATCH` | File changed between the device and the server |
| `AI_OBSERVATION` | Advisory observation |

The enum appears in tier 3 only, labelled "finding code", for someone
cross-referencing the API.

### Sentence case — already in §3.3, now enforced

No `REVIEW QUEUE`. No `EVIDENCE COMPARISON`. No `FORENSIC FINDINGS (4)`.
No `LITERAL FORENSIC EVIDENCE`. No `CLAIMED VS VERIFIED TRACK RECORD`.

Write "Review queue", "Evidence", "Findings", "Claimed vs verified".

Letter-spaced uppercase micro-labels are the loudest tell of a templated
dark dashboard. The only uppercase permitted anywhere is an acronym inside a
sentence (GPS, EXIF, SHA-256).

### Per-pane budgets — Evidence Lab

| Pane | Maximum visible without interaction |
|---|---|
| Queue row | Project title, time, one severity summary chip, status. **Four elements.** Not three separate severity pills. |
| Evidence pane | The two images, the mode toggle, the zoom control. Hashes and capture times go in a collapsed strip below. |
| Findings pane | Tier 1 of each finding. Nothing expanded on load. |
| Decision bar | Three buttons, the reason field, the quorum tally. |

If a pane needs a scrollbar before the reviewer has clicked anything, it is
over budget.

### Headers earn their space

The Lab currently spends a full row on `MANGROVE AFFORESTATION`, a status
chip, the project title, and the organisation. Collapse to one line:

```
Sundarbans Coastal Mangrove Belt  ·  Bagerhat Climate Resiliency Co-op   [In review]
```

Activity type moves into the collapsed detail strip. It is not something a
reviewer needs while comparing photographs.

---

## 3. Interaction corrections

**The comparison slider is the primary interaction in the Lab.** It should
fill its pane, respond instantly to drag, and the handle should be large
enough to grab without aiming. Everything else in that pane is secondary and
should recede.

**Collapsed by default means collapsed.** No section opens on load because it
seems important. The reviewer opens what they need.

**One accent per screen.** Count the `--signal` lime elements on any screen.
If there is more than one, the others are wrong.

**Monospace is for values, not labels.** A hash, a distance, a coordinate, a
timestamp: monospace. A heading, a label, a sentence: the sans face. The
current build puts monospace on section headers, which makes the whole
interface read like terminal output.

---

## 4. Checklist before any Lane B surface is called done

- [ ] Surfaces use v2 neutral tokens; no semantic colour on chrome
- [ ] Every badge is a 14% tint with a dot, not a solid fill
- [ ] Exactly one `--signal` element on the screen
- [ ] No ALL CAPS anywhere
- [ ] No database enum visible in tier 1 or 2
- [ ] Nothing expanded on load
- [ ] Every dense component has all three tiers implemented
- [ ] Monospace only on values
- [ ] A person who has never seen the product can read tier 1 and understand
      what the system is telling them
