# 04 — Authentication, Tenancy and the Conflict-of-Interest Rule

Authority over: sessions, organisations, roles, authorisation guards.

---

## 1. Stack

`better-auth` stable `1.x` with the `organization` plugin and
`better-auth/adapters/drizzle`.

```ts
// src/server/auth/index.ts
import "server-only";
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({ /* … */ }),
    nextCookies(),          // MUST be last
  ],
});
```

Rules:

- Generate the auth schema with the Better Auth CLI **`generate` only**.
  Never run its `migrate`. Drizzle Kit owns migrations.
- `nextCookies()` is always the final plugin.
- Forbidden: `next-auth`, `@auth/*`. See `docs/07-DEPENDENCIES.md`.
- Email (X6, `src/server/email.ts`): with `RESEND_API_KEY` and `EMAIL_FROM` (Resend's HTTP API,
  free tier), or `EMAIL_OUTBOX_DIR` on a development machine, sign-up requires a confirmed address,
  sign-in with an unconfirmed one sends a new link, and a forgotten password is reset by email
  (every other session signed out). With neither, as on the demo build, verification is off and
  the README says so. The organisation chosen at sign-up is created on `/sign-up/finish`, once the
  link has signed the person in.

## 2. The two-level model

**Organisation type** — what an organisation *is*. Set at creation, immutable
without an admin action that writes an audit event.

| `org_type` | Capability |
|---|---|
| `OWNER` | Creates projects, submits evidence |
| `VERIFIER` | Reviews submissions on assigned projects |
| `FUNDER` | Read-only |

**Member role** — what a user is *inside* their organisation.

| Role | Capability |
|---|---|
| `owner` | Manage the org, invite members, create projects |
| `admin` | Invite members, create projects. In a `VERIFIER` org assigned to a project: casts the deciding vote on an `ESCALATED` submission (§4) |
| `member` | Submit evidence (OWNER orgs) or review (VERIFIER orgs) |

Both must be satisfied. A `member` of a `FUNDER` org can never review,
whatever their role name suggests.

## 3. `activeOrganizationId` is UI context only

`session.activeOrganizationId` tells the UI which organisation to render. It
is **not** an authorisation claim.

Every service function independently re-verifies, against the database, that
the session user is a current member of the organisation the operation
concerns. A session field is client-influenced state; membership is a row.

## 4. The conflict-of-interest rule

> **A review decision is valid only if the reviewer's organisation is not the
> project's owner organisation, and that organisation is explicitly assigned
> to the project.**

Both conditions. Assignment alone is not enough; a different org alone is not
enough.

### Where it is enforced

In `reviews.service.ts`, inside the same transaction as the decision write:

```ts
async function assertCanReview(userId: string, submissionId: string) {
  const row = await db /* join submission → project → membership */;

  if (!row) throw new ForbiddenError("submission not found or not visible");
  if (row.reviewerOrgId === row.ownerOrgId)
    throw new ConflictOfInterestError("cannot review your own organisation's submission");
  if (row.reviewerOrgType !== "VERIFIER")
    throw new ForbiddenError("organisation is not a verifier");
  if (!row.isAssigned)
    throw new ForbiddenError("organisation is not assigned to this project");
  if (row.alreadyDecidedByThisUser)
    throw new ConflictError("this user has already decided in this round");
}
```

### Escalation — the deciding vote

A 1 approve / 1 reject split moves the submission to `ESCALATED`. It is
resolved by one further vote, to `APPROVED` or `REJECTED`, from a verifier-org
administrator.

This is not an override. A platform admin tie-break would breach the
conflict-of-interest rule; an `admin` **inside an assigned verifier
organisation** is independent of the project owner, and their vote is
attributable and hash-chained like any other.

- The escalation voter must pass the full `assertCanReview` gate, plus
  `member.role === 'admin'` within a `VERIFIER` org assigned to the project.
- They must not have already voted in this round. An admin who already voted
  cannot break their own tie.
- A **platform** admin still cannot vote.
- The escalation decision requires a written reason of at least 20 characters,
  like any other decision.

### Where it is **not** enforced

Not in the UI alone. Not in `proxy.ts`. Not by hiding a button. Those are
courtesies to the user, not security.

### No override

There is no admin override, no feature flag, no `DEMO_MODE` bypass, no
"force approve". If a product requirement ever seems to need one, it is
wrong. Stop and ask.

### Required test suite — `test/integration/coi.test.ts`

| Case | Expectation |
|---|---|
| OWNER member reviews own org's submission | `ConflictOfInterestError` |
| VERIFIER member reviews unassigned project | `ForbiddenError` |
| FUNDER member attempts review | `ForbiddenError` |
| Assigned verifier reviews | succeeds |
| Same verifier user decides twice in the same round | `ConflictError` |
| Same verifier user decides again in a later round | succeeds |
| Two distinct verifier users approve | status → `APPROVED` |
| Two reject | status → `REJECTED`, terminal |
| One approve + one reject | status → `ESCALATED` |
| Verifier-org admin (assigned, not yet voted) casts deciding vote | succeeds; status → `APPROVED` or `REJECTED` |
| Verifier-org non-admin member votes on `ESCALATED` | `ForbiddenError` |
| Verifier-org admin who already voted this round votes on `ESCALATED` | `ConflictError` |
| Admin of an unassigned verifier org votes on `ESCALATED` | `ForbiddenError` |
| Platform admin attempts to approve | `ForbiddenError` (see note below) |
| Org A reads Org B's submission by id | 404, not 403 — no existence disclosure |

This suite must pass before any reviewer UI is built.

> **Platform-admin row, as of 2026-11-14.** The platform admin is an *operator*: an
> account whose address is listed in `OPERATOR_EMAILS` (`src/server/services/operators.ts`;
> on a demo deployment also the seeded `audit-admin@delta-demo.example`). The test lists
> its user as an operator and proves the role grants no vote and cannot break a tie.
> Operators run `/admin`: anchoring, the job queue, audit-chain checks, assigning a verifier
> organisation to a project, and matchRef resolution. Organisations never assign themselves.
> Where email is configured, an address counts as an operator only once its owner has confirmed
> it. Where it is not, verification is off, so an operator's account must exist before its
> address is listed on a deployment others can sign up to.

## 5. Tenant isolation

Every read is scoped. Default to invisible.

| Caller | Sees |
|---|---|
| Unauthenticated | `ACTIVE` projects with **fuzzed** geometry; approved proof dossiers |
| OWNER member | Own org's projects, submissions, findings, exact geometry |
| Assigned VERIFIER member | Assigned projects, their submissions, findings, exact geometry |
| Unassigned VERIFIER | Same as unauthenticated |
| FUNDER member | Approved, anchored records of projects linked to their organisation through `project_funder`. Never pending or rejected, never an unlinked project |
| Admin | Metadata, queue health, assignments. **Not** review powers |

Cross-tenant requests return **404**, never 403. A 403 confirms the resource
exists, which is itself a leak.

`test/integration/tenancy.test.ts` asserts that for every service read
function, a caller from an unrelated organisation gets nothing.

## 6. Route protection

`src/proxy.ts` (Next 16 — **never create `middleware.ts`**) performs an
optimistic session check and redirects anonymous users away from
`(workspace)` routes. This is a redirect for user experience. The real
authorisation happens in services on every call, including when the page
renders.

## 7. API key authentication

Public API callers present `Authorization: Bearer dmrv_<prefix>_<secret>`.

- Store only the `key_prefix` and a SHA-256 `key_hash`. The secret is shown
  once at creation and never again.
- Look up by prefix, then compare hashes in constant time.
- Keys are scoped to one organisation and a scope list. They can never carry
  review or write permissions in v1 — read only.
- Revocation is a timestamp, not a delete.

## 8. Demo accounts

Gated by `DEMO_MODE=true`.

Real seeded users with real password hashes and real sessions — not a
pretend-login shim. The role switcher signs in as one of:

| Account | Org | Type |
|---|---|---|
| Field submitter | Sundarbans Restoration Trust | OWNER |
| Verifier one | Delta Independent Audit | VERIFIER |
| Verifier two | Delta Independent Audit | VERIFIER |
| Funder | Coastal Resilience Fund | FUNDER |

Two verifier accounts exist specifically so a visitor can experience the
2-of-N quorum. When `DEMO_MODE` is unset, the switcher and its route do not
exist in the build.
