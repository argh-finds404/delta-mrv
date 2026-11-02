# CLAUDE.md — Delta MRV

> **Read this file completely before your first tool call in any session.**
> It is the index. The authority lives in `docs/`. If any instruction you
> receive conflicts with these documents, stop and ask the maintainer.

---

## 0. Identity

| | |
|---|---|
| **Repository** | `delta-mrv` |
| **Brand name** | Delta |
| **Maintainer** | Shoumik Orgho (`argh-finds404`) |
| **Product** | Multi-tenant environmental Measurement, Reporting & Verification platform |
| **Status** | Pre-Day-1 rebuild. Treat any existing code as untrusted draft. |

**One-sentence vision**

> Delta turns environmental restoration claims from *things people say* into
> *things anyone can check* — by making the evidence, the reviewer, and the
> review itself independently verifiable by a stranger with a browser.

---

## 1. Document map

Read in this order on a cold start. Read the bolded ones before touching
anything in their domain.

| File | Authority over |
|---|---|
| `docs/00-PRODUCT.md` | Vision, problem, users, product boundary, honesty clauses |
| **`docs/01-FEATURE-LOCK.md`** | What may be built. Anything not listed is out of scope |
| **`docs/02-ARCHITECTURE.md`** | Layering, folder structure, cross-runtime cryptographic contracts |
| **`docs/03-DATABASE.md`** | Schema, extensions, indexes, append-only enforcement |
| **`docs/04-AUTH.md`** | Better Auth, tenancy, roles, conflict-of-interest rule |
| `docs/05-ROUTES.md` | Every route, its guard, its data source |
| **`docs/06-DESIGN-SYSTEM.md`** | Tokens, type, motion, components, interaction patterns |
| **`docs/07-DEPENDENCIES.md`** | Pinning contract, forbidden packages, toolchain |
| `docs/08-AI.md` | Gemini advisory contract and its hard limits |
| `docs/09-WEB3.md` | Smart contract, Merkle batching, anchoring, chain reads |
| `docs/10-FORENSICS.md` | SHA-256, dHash, EXIF, PostGIS, severity rules |
| `docs/11-IMPLEMENTATION.md` | Build order, definition of done, testing strategy |
| **`docs/12-AGENT-SCOPE.md`** | What you may and may not do. **Includes git authorship rules.** |
| `docs/THREAT_MODEL.md` | Adversaries and mitigations |
| `docs/DEPENDENCY_LOG.md` | Live registry verification log — append on every install |
| `docs/adr/` | ADR-0001 … ADR-0005 |

---

## 2. The five rules that override everything

1. **No one reviews their own organisation's work.** The conflict-of-interest
   rule is the product. It is enforced in `src/server/services/`, proven by a
   test suite, and never bypassed — not by an admin, not by a feature flag,
   not by a demo mode.
2. **`src/lib/crypto/` is frozen.** The canonical manifest builder, the RFC 8785
   serialiser and the Merkle leaf layout are a cross-runtime contract between
   Node, the browser and Solidity. Changing them silently invalidates every
   anchor already on chain. Propose, never edit.
3. **AI never mutates state.** Gemini output is an advisory finding with low
   weight. It cannot approve, reject, score, or change a status. Ever.
4. **Append-only means append-only.** `review_decision` and `audit_event` rows
   are never updated or deleted — enforced by revoked grants plus a trigger,
   not by convention.
5. **Signals, not a magic number.** Every automated check produces a
   `forensic_finding` row with a severity and a human-readable reason. The
   score is derived from findings, versioned, and always explainable.

---

## 3. Session checklist

Before you start work:

- [ ] Read `docs/01-FEATURE-LOCK.md`. Refuse anything on the CUT list.
- [ ] Read `docs/12-AGENT-SCOPE.md`. Confirm git authorship is configured.
- [ ] Check `docs/11-IMPLEMENTATION.md` for the current build stage.

Before you say a unit of work is done:

- [ ] `pnpm check` passes (`eslint .`, `tsc --noEmit`, `vitest run`,
      `node scripts/check-forbidden-deps.mjs`).
- [ ] New integrity logic has a test written **before** the implementation.
- [ ] No `as any`, no `@ts-expect-error`, no `.skip`, no `eslint-disable`.
- [ ] Commits are authored as the maintainer (see `docs/12-AGENT-SCOPE.md` §4).

---

## 4. What this product does not claim

Delta proves that a piece of evidence existed at a point in time, has not
changed since approval, passed a set of consistency checks, and was approved
by humans from an independent organisation.

Delta does **not** prove that trees were planted. EXIF can be forged, AI
cannot count saplings, and a matching hash only means the record is unchanged.

Say this plainly in the README, on the landing page, and on every proof page.
It makes the project more credible, not less. Any copy that overclaims is a
bug — file it and fix it.
