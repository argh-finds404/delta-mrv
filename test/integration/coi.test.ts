import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { evidenceSubmission, member } from "../../src/server/db/schema";
import {
  ConflictError,
  ConflictOfInterestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../src/server/services/errors";
import { assertCanReview, castDecision } from "../../src/server/services/reviews.service";
import { getSubmission } from "../../src/server/services/submissions.service";
import { client, inRollback, type Tx } from "./db";
import { actor, asOperators, REASON, world, type World } from "./fixtures";

afterAll(() => client.end());

type Decision = "APPROVE" | "REJECT" | "REQUEST_MORE_PROOF";

/** One test = one rolled-back transaction around a fresh world. */
const scenario = (name: string, fn: (tx: Tx, w: World) => Promise<void>) =>
  it(name, () =>
    inRollback(async (tx) => {
      await fn(tx, await world(tx));
    }),
  );

const decide = (tx: Tx, w: World, who: { id: string }, decision: Decision, reason = REASON) =>
  castDecision(actor(who), w.submission.id, { decision, reason }, tx);

const statusOf = async (tx: Tx, w: World) =>
  (await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, w.submission.id)))[0]!;

/** Stand-in for the owner adding a supplement (Stage 4): back to review in the next round. */
const startNextRound = (tx: Tx, w: World) =>
  tx
    .update(evidenceSubmission)
    .set({ status: "IN_REVIEW", round: 2 })
    .where(eq(evidenceSubmission.id, w.submission.id));

describe("conflict of interest (docs/04-AUTH.md §4)", () => {
  scenario("OWNER member reviews own org's submission -> ConflictOfInterestError", async (tx, w) => {
    await expect(decide(tx, w, w.u.ownerMember, "APPROVE")).rejects.toBeInstanceOf(ConflictOfInterestError);
    await expect(decide(tx, w, w.u.ownerAdmin, "APPROVE")).rejects.toBeInstanceOf(ConflictOfInterestError);
  });

  scenario("VERIFIER member reviews unassigned project -> ForbiddenError", async (tx, w) => {
    await expect(decide(tx, w, w.u.rivalMember, "APPROVE")).rejects.toBeInstanceOf(ForbiddenError);
  });

  scenario("FUNDER member attempts review -> ForbiddenError", async (tx, w) => {
    await expect(decide(tx, w, w.u.funder, "APPROVE")).rejects.toBeInstanceOf(ForbiddenError);
  });

  scenario("assigned verifier reviews -> succeeds", async (tx, w) => {
    const r = await decide(tx, w, w.u.v1, "APPROVE");
    expect(r).toMatchObject({ status: "IN_REVIEW", round: 1 }); // one approval is not a quorum
  });

  scenario("same verifier user decides twice in the same round -> ConflictError", async (tx, w) => {
    await decide(tx, w, w.u.v1, "APPROVE");
    const again = decide(tx, w, w.u.v1, "REJECT");
    await expect(again).rejects.toBeInstanceOf(ConflictError);
    await expect(again).rejects.toThrow(/already decided/);
  });

  scenario("same verifier user decides again in a later round -> succeeds", async (tx, w) => {
    expect(await decide(tx, w, w.u.v1, "REQUEST_MORE_PROOF")).toMatchObject({ status: "NEEDS_MORE_PROOF" });
    await startNextRound(tx, w);
    expect(await decide(tx, w, w.u.v1, "APPROVE")).toMatchObject({ status: "IN_REVIEW", round: 2 });
  });

  scenario("two distinct verifier users approve -> APPROVED", async (tx, w) => {
    await decide(tx, w, w.u.v1, "APPROVE");
    expect(await decide(tx, w, w.u.v2, "APPROVE")).toMatchObject({ status: "APPROVED" });
    expect((await statusOf(tx, w)).status).toBe("APPROVED");
  });

  scenario("two reject -> REJECTED, terminal", async (tx, w) => {
    await decide(tx, w, w.u.v1, "REJECT");
    expect(await decide(tx, w, w.u.v2, "REJECT")).toMatchObject({ status: "REJECTED" });
    // terminal: not even the verifier-org admin can reopen it
    await expect(decide(tx, w, w.u.vAdmin, "APPROVE")).rejects.toBeInstanceOf(ConflictError);
    expect((await statusOf(tx, w)).status).toBe("REJECTED");
  });

  scenario("one approve + one reject -> ESCALATED", async (tx, w) => {
    await decide(tx, w, w.u.v1, "APPROVE");
    expect(await decide(tx, w, w.u.v2, "REJECT")).toMatchObject({ status: "ESCALATED" });
    expect((await statusOf(tx, w)).status).toBe("ESCALATED");
  });
});

describe("escalation: the deciding vote", () => {
  const escalate = async (tx: Tx, w: World) => {
    await decide(tx, w, w.u.v1, "APPROVE");
    await decide(tx, w, w.u.v2, "REJECT");
  };

  scenario("verifier-org admin (assigned, not yet voted) casts the deciding vote -> APPROVED", async (tx, w) => {
    await escalate(tx, w);
    expect(await decide(tx, w, w.u.vAdmin, "APPROVE")).toMatchObject({ status: "APPROVED" });
  });

  scenario("...or REJECTED", async (tx, w) => {
    await escalate(tx, w);
    expect(await decide(tx, w, w.u.vAdmin, "REJECT")).toMatchObject({ status: "REJECTED" });
  });

  scenario("verifier-org non-admin member votes on ESCALATED -> ForbiddenError", async (tx, w) => {
    await escalate(tx, w);
    await expect(decide(tx, w, w.u.v3, "APPROVE")).rejects.toBeInstanceOf(ForbiddenError);
    expect((await statusOf(tx, w)).status).toBe("ESCALATED");
  });

  scenario("verifier-org admin who already voted this round votes on ESCALATED -> ConflictError", async (tx, w) => {
    await decide(tx, w, w.u.vAdmin, "APPROVE");
    await decide(tx, w, w.u.v1, "REJECT"); // 1 approve + 1 reject: the admin is one of the two
    expect((await statusOf(tx, w)).status).toBe("ESCALATED");
    await expect(decide(tx, w, w.u.vAdmin, "APPROVE")).rejects.toBeInstanceOf(ConflictError);
  });

  scenario("admin of an unassigned verifier org votes on ESCALATED -> ForbiddenError", async (tx, w) => {
    await escalate(tx, w);
    await expect(decide(tx, w, w.u.rivalAdmin, "APPROVE")).rejects.toBeInstanceOf(ForbiddenError);
  });

  scenario("platform admin attempts to approve -> ForbiddenError", async (tx, w) => {
    // A real operator (OPERATOR_EMAILS) with no organisation: the role grants no vote...
    await asOperators([w.u.platformAdmin], async () => {
      await expect(decide(tx, w, w.u.platformAdmin, "APPROVE")).rejects.toBeInstanceOf(ForbiddenError);
      // ...nor can it break a tie
      await escalate(tx, w);
      await expect(decide(tx, w, w.u.platformAdmin, "APPROVE")).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  scenario("an escalated submission cannot be sent back for more proof -> ConflictError", async (tx, w) => {
    await escalate(tx, w);
    await expect(decide(tx, w, w.u.vAdmin, "REQUEST_MORE_PROOF")).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("assertCanReview: the five rejections, in order", () => {
  scenario("rejection 1: a missing submission -> ForbiddenError, not found or not visible", async (tx, w) => {
    const gate = assertCanReview(w.u.v1.id, "00000000-0000-4000-8000-000000000000", tx);
    await expect(gate).rejects.toBeInstanceOf(ForbiddenError);
    await expect(gate).rejects.toThrow(/not found or not visible/);
    await expect(assertCanReview(w.u.v1.id, "not-a-uuid", tx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  scenario("rejection 2 beats 3, 4 and 5: an owner-org member is a conflict of interest first", async (tx, w) => {
    // Also an assigned verifier-org member and a previous voter. Conflict of interest still wins.
    await tx.insert(member).values({ organizationId: w.org.verifier.id, userId: w.u.ownerMember.id, role: "member", createdAt: new Date() });
    await expect(assertCanReview(w.u.ownerMember.id, w.submission.id, tx)).rejects.toBeInstanceOf(ConflictOfInterestError);
  });

  scenario("rejection 3: not a VERIFIER org -> ForbiddenError, before the assignment check", async (tx, w) => {
    const gate = assertCanReview(w.u.funder.id, w.submission.id, tx);
    await expect(gate).rejects.toBeInstanceOf(ForbiddenError);
    await expect(gate).rejects.toThrow(/not a verifier/);
  });

  scenario("rejection 4: verifier but not assigned -> ForbiddenError", async (tx, w) => {
    const gate = assertCanReview(w.u.rivalMember.id, w.submission.id, tx);
    await expect(gate).rejects.toBeInstanceOf(ForbiddenError);
    await expect(gate).rejects.toThrow(/not assigned/);
  });

  scenario("rejection 5: already decided this round -> ConflictError", async (tx, w) => {
    await decide(tx, w, w.u.v1, "APPROVE");
    await expect(assertCanReview(w.u.v1.id, w.submission.id, tx)).rejects.toBeInstanceOf(ConflictError);
  });

  scenario("a user in both a rival and the assigned verifier org passes through the assigned one", async (tx, w) => {
    await tx.insert(member).values({ organizationId: w.org.rival.id, userId: w.u.v1.id, role: "member", createdAt: new Date() });
    await expect(assertCanReview(w.u.v1.id, w.submission.id, tx)).resolves.toMatchObject({ reviewerOrgId: w.org.verifier.id });
  });
});

describe("decisions", () => {
  scenario("quorum is evaluated over the current round only", async (tx, w) => {
    await decide(tx, w, w.u.v1, "APPROVE"); // round 1
    await decide(tx, w, w.u.v2, "REQUEST_MORE_PROOF"); // -> NEEDS_MORE_PROOF
    await startNextRound(tx, w);
    // v1's round-1 approval must not count: one approval in round 2 is not a quorum
    expect(await decide(tx, w, w.u.v3, "APPROVE")).toMatchObject({ status: "IN_REVIEW", round: 2 });
    expect(await decide(tx, w, w.u.v2, "APPROVE")).toMatchObject({ status: "APPROVED" });
  });

  scenario("any reviewer may request more proof -> NEEDS_MORE_PROOF", async (tx, w) => {
    expect(await decide(tx, w, w.u.v2, "REQUEST_MORE_PROOF")).toMatchObject({ status: "NEEDS_MORE_PROOF" });
  });

  scenario("a decision on a submission that is not in review -> ConflictError", async (tx, w) => {
    await tx.update(evidenceSubmission).set({ status: "DRAFT" }).where(eq(evidenceSubmission.id, w.submission.id));
    await expect(decide(tx, w, w.u.v1, "APPROVE")).rejects.toBeInstanceOf(ConflictError);
  });

  scenario("a reason under 20 characters -> ValidationError, nothing written", async (tx, w) => {
    await expect(decide(tx, w, w.u.v1, "APPROVE", "too short")).rejects.toBeInstanceOf(ValidationError);
    await expect(decide(tx, w, w.u.v1, "APPROVE", " ".repeat(30))).rejects.toBeInstanceOf(ValidationError);
    expect(await decide(tx, w, w.u.v1, "APPROVE")).toMatchObject({ status: "IN_REVIEW" }); // still free to vote
  });
});

describe("tenant isolation (docs/04-AUTH.md §4 table, last row)", () => {
  scenario("Org A reads Org B's submission by id -> 404, not 403", async (tx, w) => {
    const read = getSubmission(actor(w.u.outsider), w.submission.id, tx);
    await expect(read).rejects.toBeInstanceOf(NotFoundError);
    await expect(read).rejects.not.toBeInstanceOf(ForbiddenError);
  });
});
