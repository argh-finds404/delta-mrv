import { afterAll, describe, expect, it } from "vitest";
import { locationCommitment } from "../../src/lib/crypto/location";
import { projectFunder } from "../../src/server/db/schema";
import type { GeoPoint } from "../../src/server/db/schema/types";
import { ForbiddenError, NotFoundError } from "../../src/server/services/errors";
import {
  createProject,
  deleteProject,
  findProjectsCovering,
  getProject,
  listProjects,
  updateProject,
} from "../../src/server/services/projects.service";
import { listReviewQueue } from "../../src/server/services/reviews.service";
import { getSubmission, listSubmissionsForProject } from "../../src/server/services/submissions.service";
import { client, inRollback, type Tx } from "./db";
import { actor, addSubmission, INSIDE_SQUARE, OUTSIDE_SQUARE, SQUARE, world, type World } from "./fixtures";

afterAll(() => client.end());

const scenario = (name: string, fn: (tx: Tx, w: World) => Promise<void>) =>
  it(name, () =>
    inRollback(async (tx) => {
      await fn(tx, await world(tx));
    }),
  );

/** 404, never 403: a 403 would confirm that the resource exists. */
const expectNotFound = async (p: Promise<unknown>) => {
  await expect(p).rejects.toBeInstanceOf(NotFoundError);
  await expect(p).rejects.not.toBeInstanceOf(ForbiddenError);
};

const NO_LEAK = (body: unknown, w: World) => {
  const json = JSON.stringify(body);
  expect(json).not.toMatch(/locationSalt|location_salt|"boundary"|"exact"\s*:\s*\{/);
  expect(json).not.toContain("90.405"); // a coordinate that only appears inside the exact polygon
  expect(json).not.toContain(w.project.exact!.locationSalt);
};

describe("projects: getProject", () => {
  scenario("an unrelated org cannot see a DRAFT project: 404", async (tx, w) => {
    const draft = await createProject(
      actor(w.u.ownerAdmin),
      { ownerOrgId: w.org.owner.id, title: "Draft", activityType: "WETLAND", boundary: SQUARE },
      tx,
    );
    for (const who of [w.u.outsider, w.u.rivalMember, w.u.funder, w.u.platformAdmin]) {
      await expectNotFound(getProject(actor(who), draft.id, tx));
    }
    await expectNotFound(getProject(null, draft.id, tx)); // anonymous
  });

  scenario("a missing project and a hidden one are indistinguishable", async (tx, w) => {
    const draft = await createProject(
      actor(w.u.ownerAdmin),
      { ownerOrgId: w.org.owner.id, title: "Draft", activityType: "WETLAND", boundary: SQUARE },
      tx,
    );
    const errorOf = (p: Promise<unknown>) =>
      p.then(
        () => {
          throw new Error("expected a rejection");
        },
        (e: Error) => e,
      );
    const hidden = await errorOf(getProject(actor(w.u.outsider), draft.id, tx));
    const missing = await errorOf(getProject(actor(w.u.outsider), "00000000-0000-4000-8000-000000000000", tx));
    const malformed = await errorOf(getProject(actor(w.u.outsider), "not-a-uuid", tx));
    expect([hidden.constructor, missing.constructor, malformed.constructor]).toEqual([NotFoundError, NotFoundError, NotFoundError]);
    expect(hidden.message).toBe(missing.message);
  });

  scenario("an unrelated caller sees an ACTIVE project only as fuzzed public data", async (tx, w) => {
    for (const who of [actor(w.u.outsider), actor(w.u.rivalMember), actor(w.u.funder), null]) {
      const p = await getProject(who, w.project.id, tx);
      expect(p.access).toBe("public");
      expect(p.exact).toBeNull();
      expect(p.fuzzedLocation).not.toBeNull();
      expect(p.locationCommitment).toMatch(/^[0-9a-f]{64}$/);
      NO_LEAK(p, w);
    }
  });

  scenario("the owner org and the assigned verifier org see the exact polygon and the salt", async (tx, w) => {
    for (const [who, access] of [[w.u.ownerMember, "owner"], [w.u.v1, "verifier"], [w.u.vAdmin, "verifier"]] as const) {
      const p = await getProject(actor(who), w.project.id, tx);
      expect(p.access).toBe(access);
      expect(p.exact!.boundary).toEqual(SQUARE);
      expect(p.exact!.locationSalt).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  scenario("an authorised caller can verify the location commitment themselves", async (tx, w) => {
    const p = await getProject(actor(w.u.v1), w.project.id, tx);
    expect(await locationCommitment(p.exact!.locationSalt, p.exact!.boundary)).toBe(p.locationCommitment);
  });

  scenario("the fuzzed location is the public one: a grid cell centre, not the polygon centroid", async (tx, w) => {
    const p = await getProject(null, w.project.id, tx);
    expect(p.fuzzedLocation).toEqual({ type: "Point", coordinates: [90.425, 23.825] });
  });
});

describe("projects: listProjects", () => {
  scenario("an unrelated org's list holds public data only and none of another org's DRAFTs", async (tx, w) => {
    const draft = await createProject(
      actor(w.u.ownerAdmin),
      { ownerOrgId: w.org.owner.id, title: "Draft", activityType: "WETLAND", boundary: SQUARE },
      tx,
    );
    for (const who of [actor(w.u.outsider), actor(w.u.funder), actor(w.u.rivalAdmin), null]) {
      const list = await listProjects(who, tx);
      expect(list.map((p) => p.id)).not.toContain(draft.id);
      for (const p of list) {
        expect(p.status).toBe("ACTIVE");
        expect(p.access).toBe("public");
      }
      NO_LEAK(list, w);
    }
  });

  scenario("the owner sees its DRAFT; the assigned verifier sees the project as 'verifier'", async (tx, w) => {
    const draft = await createProject(
      actor(w.u.ownerAdmin),
      { ownerOrgId: w.org.owner.id, title: "Draft", activityType: "WETLAND", boundary: SQUARE },
      tx,
    );
    const owner = await listProjects(actor(w.u.ownerMember), tx);
    expect(owner.find((p) => p.id === draft.id)?.access).toBe("owner");
    const verifier = await listProjects(actor(w.u.v1), tx);
    expect(verifier.find((p) => p.id === w.project.id)?.access).toBe("verifier");
    expect(verifier.map((p) => p.id)).not.toContain(draft.id); // not assigned
    for (const p of [...owner, ...verifier]) expect(p).not.toHaveProperty("exact"); // lists never carry geometry
  });
});

describe("projects: findProjectsCovering (ST_Covers)", () => {
  scenario("an unrelated caller learns nothing: no point-in-polygon oracle on exact geometry", async (tx, w) => {
    for (const who of [actor(w.u.outsider), actor(w.u.rivalMember), actor(w.u.funder), actor(w.u.platformAdmin), null]) {
      expect(await findProjectsCovering(who, INSIDE_SQUARE, tx)).toEqual([]);
    }
  });

  scenario("the owner org and the assigned verifier org get the covering project", async (tx, w) => {
    for (const who of [w.u.ownerMember, w.u.v2]) {
      const hit = await findProjectsCovering(actor(who), INSIDE_SQUARE, tx);
      expect(hit.map((p) => p.id)).toContain(w.project.id);
      expect(await findProjectsCovering(actor(who), OUTSIDE_SQUARE, tx)).toEqual([]);
    }
  });

  scenario("a vertex of the boundary counts as covered", async (tx, w) => {
    const corner: GeoPoint = { type: "Point", coordinates: [90.4, 23.8] };
    const hit = await findProjectsCovering(actor(w.u.ownerMember), corner, tx);
    expect(hit.map((p) => p.id)).toContain(w.project.id);
  });
});

describe("projects: writes", () => {
  scenario("another org's project cannot be updated or deleted: 404", async (tx, w) => {
    await expectNotFound(updateProject(actor(w.u.outsider), w.project.id, { title: "mine now" }, tx));
    await expectNotFound(deleteProject(actor(w.u.outsider), w.project.id, tx));
    await expectNotFound(updateProject(actor(w.u.v1), w.project.id, { title: "x" }, tx)); // assigned verifiers read, never write
  });

  scenario("a project cannot be created inside another org: 404", async (tx, w) => {
    await expectNotFound(
      createProject(actor(w.u.outsider), { ownerOrgId: w.org.owner.id, title: "x", activityType: "WETLAND", boundary: SQUARE }, tx),
    );
  });

  scenario("a plain member of the owner org may read but not create: 403 (they know it exists)", async (tx, w) => {
    await expect(
      createProject(actor(w.u.ownerMember), { ownerOrgId: w.org.owner.id, title: "x", activityType: "WETLAND", boundary: SQUARE }, tx),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  scenario("a VERIFIER org cannot own a project", async (tx, w) => {
    await expect(
      createProject(actor(w.u.vAdmin), { ownerOrgId: w.org.verifier.id, title: "x", activityType: "WETLAND", boundary: SQUARE }, tx),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("submissions: getSubmission / listSubmissionsForProject", () => {
  scenario("an unrelated caller gets 404 and an empty list", async (tx, w) => {
    for (const who of [w.u.outsider, w.u.rivalMember, w.u.rivalAdmin, w.u.platformAdmin]) {
      await expectNotFound(getSubmission(actor(who), w.submission.id, tx));
      expect(await listSubmissionsForProject(actor(who), w.project.id, tx)).toEqual([]);
    }
    await expectNotFound(getSubmission(null, w.submission.id, tx));
    expect(await listSubmissionsForProject(null, w.project.id, tx)).toEqual([]);
  });

  scenario("the owner org sees every status, including DRAFT", async (tx, w) => {
    const draft = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status: "DRAFT" });
    expect((await getSubmission(actor(w.u.ownerMember), draft.id, tx)).status).toBe("DRAFT");
    expect((await listSubmissionsForProject(actor(w.u.ownerAdmin), w.project.id, tx)).map((s) => s.id)).toEqual(
      expect.arrayContaining([draft.id, w.submission.id]),
    );
  });

  scenario("the assigned verifier org sees submissions in review, never a DRAFT", async (tx, w) => {
    const draft = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status: "DRAFT" });
    expect((await getSubmission(actor(w.u.v1), w.submission.id, tx)).id).toBe(w.submission.id);
    await expectNotFound(getSubmission(actor(w.u.v1), draft.id, tx));
    expect((await listSubmissionsForProject(actor(w.u.v1), w.project.id, tx)).map((s) => s.id)).toEqual([w.submission.id]);
  });

  scenario("a funder sees only APPROVED or ANCHORED submissions of a project linked to its org", async (tx, w) => {
    const approved = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status: "APPROVED" });
    // not linked yet
    await expectNotFound(getSubmission(actor(w.u.funder), approved.id, tx));
    expect(await listSubmissionsForProject(actor(w.u.funder), w.project.id, tx)).toEqual([]);

    await tx.insert(projectFunder).values({ projectId: w.project.id, funderOrgId: w.org.funder.id, createdByUserId: w.u.platformAdmin.id });
    expect((await getSubmission(actor(w.u.funder), approved.id, tx)).status).toBe("APPROVED");
    await expectNotFound(getSubmission(actor(w.u.funder), w.submission.id, tx)); // still IN_REVIEW
    expect((await listSubmissionsForProject(actor(w.u.funder), w.project.id, tx)).map((s) => s.id)).toEqual([approved.id]);
  });
});

describe("reviews: listReviewQueue", () => {
  scenario("only assigned verifier orgs see the queue; owners, rivals, funders and outsiders see nothing", async (tx, w) => {
    for (const who of [w.u.ownerAdmin, w.u.ownerMember, w.u.rivalMember, w.u.funder, w.u.outsider, w.u.platformAdmin]) {
      expect(await listReviewQueue(actor(who), tx)).toEqual([]);
    }
    const q = await listReviewQueue(actor(w.u.v1), tx);
    expect(q.map((s) => s.id)).toContain(w.submission.id);
  });

  scenario("the queue never holds a submission the caller's own org originated", async (tx, w) => {
    // v1 also joins the owner org: its own org's work must drop out of the queue
    const { member } = await import("../../src/server/db/schema");
    await tx.insert(member).values({ organizationId: w.org.owner.id, userId: w.u.v1.id, role: "member", createdAt: new Date() });
    expect((await listReviewQueue(actor(w.u.v1), tx)).map((s) => s.id)).not.toContain(w.submission.id);
  });

  scenario("DRAFT and decided submissions are not queued", async (tx, w) => {
    const draft = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status: "DRAFT" });
    const done = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status: "APPROVED" });
    const ids = (await listReviewQueue(actor(w.u.v1), tx)).map((s) => s.id);
    expect(ids).toContain(w.submission.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(done.id);
  });
});
