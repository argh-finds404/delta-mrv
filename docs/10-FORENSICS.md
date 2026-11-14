# 10 — Forensics Pipeline

Authority over: every automated signal, its severity, and how it is stored.

---

## 1. Principle

Every check produces a **finding**: a row with a kind, a severity, a reason a
human wrote, and the literal inputs that produced it.

There is no single number that decides anything. A score exists, but it is
derived from findings by a versioned pure function, it is always displayed
next to the findings that produced it, and it never gates a transition.

> A similarity match is an investigation signal, not proof of fraud.
> Missing metadata is a signal, not guilt.

## 2. Pipeline order

Runs as a job after intake. Each stage is independent; a failure in one does
not stop the others.

```
1. SHA-256 of stored bytes          deterministic, never fails
2. Exact duplicate lookup            by SHA-256
3. dHash                             sharp, 9×8
4. Perceptual duplicate search       pgvector Hamming
5. EXIF extraction                   exifr
6. Geospatial check                  PostGIS, only if EXIF GPS present
7. Before/after change delta         dHash distance between the pair
8. AI observation                    separate job, see docs/08-AI.md
```

## 3. Finding kinds

| Kind | Severity | Condition |
|---|---|---|
| `EXACT_DUPLICATE_SAME_PROJECT` | `LOW` | Identical SHA-256 within the same project |
| `EXACT_DUPLICATE_SAME_ORG` | `HIGH` | Identical SHA-256, same org, different project |
| `EXACT_DUPLICATE_OTHER_ORG` | `HIGH` | Identical SHA-256, different organisation |
| `PERCEPTUAL_MATCH_SAME_PROJECT` | `LOW` | Hamming < 8 within the same project |
| `PERCEPTUAL_MATCH_SAME_ORG` | `HIGH` | Hamming < 8, same org, different project |
| `PERCEPTUAL_MATCH_OTHER_ORG` | `HIGH` | Hamming < 8, different organisation |
| `GPS_INSIDE_BOUNDARY` | `INFO` | EXIF point inside the project polygon |
| `GPS_WITHIN_TOLERANCE` | `INFO` | Outside, but within `tolerance_meters` |
| `GPS_OUTSIDE_BOUNDARY` | `MEDIUM` | Beyond tolerance. Distance recorded. |
| `GPS_MISSING` | `LOW` | No GPS in EXIF |
| `EXIF_TIMESTAMP_MISSING` | `LOW` | No `DateTimeOriginal` |
| `EXIF_TIMESTAMP_IMPLAUSIBLE` | `MEDIUM` | Capture time before project creation or in the future |
| `EXIF_FULLY_STRIPPED` | `LOW` | No EXIF block at all |
| `NO_VISIBLE_CHANGE` | `MEDIUM` | Before/after Hamming < 4 — the pair may be the same scene |
| `CLIENT_HASH_MISMATCH` | `MEDIUM` | PWA-reported hash differs from the server hash |
| `AI_OBSERVATION` | `INFO`/`LOW` | See `docs/08-AI.md` |
| `SATELLITE_NDVI` | `INFO` | X1: Sentinel-2 NDVI over the site around each photo's date, or `inconclusive` and why. Weighs nothing; a 20 m pixel shows no plant, and seasons move it. Band files are read only from `https://sentinel-cogs.s3.us-west-2.amazonaws.com`, by range request, whatever URL the catalogue names. X7: also reads the same season (within 30 days of the date) in up to four earlier years, in parallel, and reports their median and this season's distance from it; a year with no clear view is skipped |
| `CLAIM_CHECKED` | `INFO` | X12, `claims.v1`, once per submission: the claimed area fits the registered boundary, or the claimed plants per hectare, with the arithmetic |
| `CLAIM_EXCEEDS_AREA` | `MEDIUM` | The claimed area is more than 1.05 times the boundary's spheroid area (PostGIS `ST_Area`) |
| `CLAIM_DENSITY_IMPLAUSIBLE` | `MEDIUM` | More than 5 plants per square metre: denser than the densest planting methods (Miyawaki-style, about 3 to 5). Units it cannot read (kg, households) are not checked |
| `CONTENT_CREDENTIALS` | `INFO` | X9, `c2pa.v1`: reads embedded C2PA Content Credentials (JUMBF) via `@contentauth/c2pa-wasm` (`WasmReader.fromBytes`), verifies the claim signature and image data hash, and records the signer, generator, timestamp and validation outcome (`valid`, `invalid`, or `absent`). Always `INFO` (weighs nothing); most cameras do not sign photos yet |

### The severity rule that matters

**Same project → `LOW`. Same org, different project → `HIGH`. Different org
→ `HIGH`.**

A time-lapse of the same mangrove plot is legitimate and expected. The same
photograph claimed against two grants is the fraud this product exists to
catch.

### Severity is never inferred

Severity comes from this table. Do not compute it, do not let the AI
influence it, do not scale it by confidence.

## 4. Cross-tenant disclosure

A `*_OTHER_ORG` finding tells the submitter and the reviewer **that** a match
exists and how close it is. It never reveals which organisation, which
project, which submission, or where.

The finding's `evidence` jsonb, when read by a non-privileged caller, carries
the Hamming distance, the threshold and the rule version — and an opaque
`matchRef`. Only a platform admin can resolve `matchRef` to a submission, and
doing so writes an `audit_event`.

This is the hardest requirement in the pipeline and the most valuable.
`test/integration/forensics-disclosure.test.ts` must assert that no
cross-organisation identifier appears in any payload reachable by an
unprivileged caller.

## 5. Implementations

### SHA-256
`node:crypto`, over the bytes read back from blob storage — never over the
buffer the client sent. 64-character lowercase hex.

### dHash
`sharp`: grayscale → resize to exactly 9×8 with the **`lanczos3`** kernel and
`fit: "fill"` → compare adjacent horizontal pixels per row → pack row-major, MSB
first → 64-character `'0'|'1'` string. The kernel is frozen with the rest of
the contract (docs/02-ARCHITECTURE.md §4.2); pass `DHASH_RESIZE` from
`src/lib/forensics/dhash.ts`, never a literal.

Identical code path in `forensics.service.ts`, `scripts/seed.ts` and
`scripts/eval-forensics.ts`. A single shared function. Three implementations
that drift is how an eval harness starts lying.

### Perceptual search

```sql
SELECT f.id, f.submission_id, s.project_id, s.owner_org_id,
       (f.dhash <~> $1::bit(64)) AS distance
FROM evidence_file f
JOIN evidence_submission s ON s.id = f.submission_id
WHERE f.dhash IS NOT NULL
  AND f.id <> $2
  AND (f.dhash <~> $1::bit(64)) < 8
ORDER BY distance ASC
LIMIT 5;
```

Threshold **8**. Justify it with the eval harness, not with a guess. Record
the chosen value and its precision/recall in `docs/FORENSIC_EVAL.md`.

The search is intentionally global across all tenants — that is what catches
double-claiming. Only the *result disclosure* is scoped (§4).

### EXIF
`exifr` with `{ gps: true, tiff: true, exif: true }`. Extract GPS, 
`DateTimeOriginal`, make and model, dimensions.

**Never invent a value.** If GPS is absent, write `GPS_MISSING` and leave the
column null. Absent metadata is not a mismatch and is never treated as one.

### Geospatial

```sql
SELECT
  ST_Covers(boundary, $1::geography)                      AS inside,
  ST_Distance(boundary, $1::geography)                    AS distance_m
FROM project_private_location WHERE project_id = $2;
```

`ST_Covers`, not `ST_Contains`. `ST_Contains` has no `geography` form, so it
needs a `::geometry` cast, which makes planar lon/lat decisions and cannot use
the GiST index on `boundary`. `ST_Covers` is `geography`-native, uses the index,
and is true for a point exactly on the boundary, which is the behaviour a
geofence wants. The "within tolerance" outcome uses
`ST_DWithin(boundary, $1::geography, tolerance_meters)`.

`geography` gives metres on a sphere directly. No Haversine implementation
and no reprojection — the database already does this correctly, and a
hand-rolled distance function is a source of drift.

### Browser geolocation
Captured at upload when offered. Stored separately and **always labelled a
weak signal** — it reflects where the phone was when the form was submitted,
not where the photograph was taken. It never produces a `HIGH` finding.

## 6. Derived score

```ts
// src/lib/scoring/v1.ts — pure, versioned, unit-tested
export const SCORING_VERSION = "scoring.v1";
const WEIGHTS = { INFO: 0, LOW: 1, MEDIUM: 4, HIGH: 12 } as const;
const AI_FACTOR = 0.25;
```

- Pure function of the findings array. No database, no clock, no randomness.
- Changing weights means a new version. Old submissions keep their original
  version so historical scores stay reproducible.
- The score is displayed as a band — `clear` / `review` / `concern` — never
  as a probability and never as a percentage.
- The score **never** gates a transition. A reviewer with a `concern` band
  can approve; a reviewer with a `clear` band can reject. Both must write a
  reason.

### Cached columns

Sorting a 5,000-row Lab queue by a score computed from a join over findings is
slow, and queue ordering is a core interaction, so the result is cached on
`evidence_submission` as `risk_score`, `risk_band` and `scoring_version`
(`docs/03-DATABASE.md`). Four conditions:

1. The value is **only ever written by the pure function** in
   `src/lib/scoring/`. Never by hand, never by the AI, never by an admin.
2. `scoring_version` is stored with it, so a weights change does not silently
   rewrite history. Old submissions keep their original version.
3. It is **never rendered without its findings beside it**.
4. It never gates a transition (above).

What this prevents is an unexplainable number that decides outcomes. A
versioned cache of an explainable function, always shown with its inputs, is
not that.

## 7. Deterministic replay

`scripts/replay-forensics.ts <submissionId>` re-reads the stored bytes,
re-runs stages 1–7, and asserts byte-identical output against the stored
findings. Excludes `AI_OBSERVATION` and `SATELLITE_NDVI`, which are not reproducible (a
model, a live archive). `CLAIM_*` and `CONTENT_CREDENTIALS` findings are compared only for a record
that has one: a record checked before `claims.v1` or `c2pa.v1` existed is not re-judged by a rule it
never ran.

A replay mismatch means the pipeline drifted and is a critical defect.

## 8. Eval harness

`scripts/eval-forensics.ts` runs a labelled fixture set through the real
pipeline:

| Class | Expected |
|---|---|
| Authentic, unmodified | no duplicate finding |
| Resized 50 % | perceptual match |
| Re-compressed at quality 60 | perceptual match |
| Cropped 10 % | perceptual match |
| Cropped 40 % | may miss — record it |
| Rotated 90° | expected miss — dHash is not rotation-invariant. Document it. |
| Different scene, same site | no match |
| Known cross-project duplicate | `HIGH` finding |

Outputs precision and recall per class into `docs/FORENSIC_EVAL.md`.

**Publish the misses.** Stating that dHash misses 90° rotations and heavy
crops is what makes the rest of the numbers believable.
