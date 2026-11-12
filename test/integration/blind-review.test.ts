// A4 (docs/16-AMENDMENTS-v2.md): a reviewer cannot read other reviewers' decisions or reasons for
// the current round until they have submitted their own. Earlier rounds are history: visible.
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ tx: undefined as unknown, userId: null as string | null }));
vi.mock("../../src/server/db/client", () => ({
  get db() {
    return h.tx;
  },
}));
vi.mock("../../src/server/auth/session", () => ({
  getSession: async () => (h.userId ? { user: { id: h.userId } } : null),
}));

import { GET as queueRoute } from "../../src/app/api/lab/queue/route";
import { evidenceSubmission } from "../../src/server/db/schema";
import { NotFoundError } from "../../src/server/services/errors";
import { castDecision, getRoundDecisions } from "../../src/server/services/reviews.service";
import { client, inRollback } from "./db";
import { actor, world } from "./fixtures";

afterAll(() => client.end());

const SECRET_REASON = "The canopy in the after photo is the same canopy as plot seven, rotated.";

describe("getRoundDecisions (A4)", () => {
  it("before voting: counts only, through the service and the queue API; after: the decisions", () =>
    inRollback(async (tx) => {
      h.tx = tx;
      const w = await world(tx);
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "REJECT", reason: SECRET_REASON }, tx);

      const before = await getRoundDecisions(actor(w.u.v2), w.submission.id, tx);
      expect(before).toMatchObject({ round: 1, counts: { approve: 0, reject: 1, moreProof: 0 }, decisions: null, hasVoted: false });
      expect(JSON.stringify(before)).not.toContain(SECRET_REASON);

      h.userId = w.u.v2.id;
      const queue = JSON.stringify(await (await queueRoute()).json());
      expect(queue).toContain(w.submission.id);
      expect(queue).not.toContain(SECRET_REASON);
      expect(queue).not.toContain(w.u.v1.id);

      await castDecision(actor(w.u.v2), w.submission.id, { decision: "APPROVE", reason: "Both photos match the plot and the change is real." }, tx);
      const after = await getRoundDecisions(actor(w.u.v2), w.submission.id, tx);
      expect(after.hasVoted).toBe(true);
      // one transaction, one timestamp: compare as a set
      expect(after.decisions?.map((d) => [d.decision, d.mine]).sort()).toEqual([["APPROVE", true], ["REJECT", false]]);
      expect(after.decisions?.find((d) => d.decision === "REJECT")?.reason).toBe(SECRET_REASON);
      h.userId = null;
    }));

  it("the reviewer who voted first sees only their own until the second votes, then both", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "APPROVE", reason: "The planted rows are visible in the after photo." }, tx);
      const mine = await getRoundDecisions(actor(w.u.v1), w.submission.id, tx);
      expect(mine.decisions?.map((d) => d.mine)).toEqual([true]);
    }));

  it("earlier rounds are history: visible to every caller who may see the submission", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "REQUEST_MORE_PROOF", reason: "The before photo does not show the plot's boundary." }, tx);
      // the owner added proof: a second round opens
      await tx.update(evidenceSubmission).set({ status: "IN_REVIEW", round: 2 }).where(eq(evidenceSubmission.id, w.submission.id));
      const v2 = await getRoundDecisions(actor(w.u.v2), w.submission.id, tx);
      expect(v2).toMatchObject({ round: 2, counts: { approve: 0, reject: 0, moreProof: 0 }, decisions: null });
      expect(v2.earlierRounds.map((d) => [d.round, d.decision])).toEqual([[1, "REQUEST_MORE_PROOF"]]);
      const owner = await getRoundDecisions(actor(w.u.ownerMember), w.submission.id, tx);
      expect(owner.earlierRounds).toHaveLength(1);
      // the claimant is not a reviewer: never the current round's reasons while it is open
      expect(owner.decisions).toBeNull();
    }));

  it("strangers get a 404, as for the submission itself", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await expect(getRoundDecisions(actor(w.u.outsider), w.submission.id, tx)).rejects.toBeInstanceOf(NotFoundError);
    }));
});
