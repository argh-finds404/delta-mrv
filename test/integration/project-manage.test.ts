// /projects/[id]/manage (docs/05-ROUTES.md §3): what an owner may still change about a project.
//   - the name, the claim and the tolerance are what reviewers judge evidence against, and the
//     proof page shows them beside every approval: once evidence has been sent they are fixed
//   - the description stays editable, and the project can be closed
//   - only an owner or admin of the owning organisation changes anything
import { afterAll, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "../../src/server/services/errors";
import { createProject, listProjectReviewers, updateProject } from "../../src/server/services/projects.service";
import { client, inRollback } from "./db";
import { actor, addSubmission, SQUARE, world } from "./fixtures";

afterAll(() => client.end());

describe("changing a project", () => {
  it("is free before any evidence is sent, a draft submission included", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const fresh = await createProject(actor(w.u.ownerAdmin), { ownerOrgId: w.org.owner.id, title: `Fresh ${w.tag}`, activityType: "WETLAND", claimedQuantity: 10, claimedUnit: "hectares", boundary: SQUARE }, tx);
      await updateProject(actor(w.u.ownerAdmin), fresh.id, { status: "ACTIVE" }, tx);
      await addSubmission(tx, { projectId: fresh.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status: "DRAFT" });

      const changed = await updateProject(actor(w.u.ownerAdmin), fresh.id, { title: `Renamed ${w.tag}`, claimedQuantity: 12.5, claimedUnit: "ha", toleranceMeters: 250, description: "Reed beds." }, tx);
      expect(changed).toMatchObject({ title: `Renamed ${w.tag}`, claimedQuantity: "12.5", claimedUnit: "ha", toleranceMeters: 250, description: "Reed beds." });
    }));

  it("keeps the name, the claim and the tolerance fixed once evidence has been sent", () =>
    inRollback(async (tx) => {
      const w = await world(tx); // its project has one submission in review
      const admin = actor(w.u.ownerAdmin);
      await updateProject(admin, w.project.id, { claimedQuantity: 40, claimedUnit: "hectares" }, tx).then(
        () => expect.unreachable("the claim changed under a submission in review"),
        (e: unknown) => expect(e).toBeInstanceOf(ConflictError),
      );
      for (const patch of [{ title: "A bigger name" }, { claimedQuantity: 1 }, { claimedUnit: "trees" }, { toleranceMeters: 4000 }]) {
        await expect(updateProject(admin, w.project.id, patch, tx)).rejects.toBeInstanceOf(ConflictError);
      }
      // what does not touch them still goes through: the description, and sending the same values back
      const saved = await updateProject(admin, w.project.id, { description: "Planted in three blocks.", title: w.project.title, toleranceMeters: w.project.toleranceMeters }, tx);
      expect(saved).toMatchObject({ description: "Planted in three blocks.", title: w.project.title, claimedQuantity: null });
      expect((await updateProject(admin, w.project.id, { status: "CLOSED" }, tx)).status).toBe("CLOSED");
    }));

  it("is for an owner or admin of the owning organisation only", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await expect(updateProject(actor(w.u.ownerMember), w.project.id, { description: "x" }, tx)).rejects.toBeInstanceOf(ForbiddenError);
      for (const who of [w.u.v1, w.u.vAdmin, w.u.funder, w.u.outsider, w.u.platformAdmin]) {
        await expect(updateProject(actor(who), w.project.id, { description: "x" }, tx)).rejects.toBeInstanceOf(NotFoundError);
      }
    }));
});

describe("who reviews a project", () => {
  it("is named to anyone who may see the project", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      expect(await listProjectReviewers(actor(w.u.ownerMember), w.project.id, tx)).toEqual([w.org.verifier.name]);
      expect(await listProjectReviewers(actor(w.u.v1), w.project.id, tx)).toEqual([w.org.verifier.name]);
      const unreviewed = await createProject(actor(w.u.ownerAdmin), { ownerOrgId: w.org.owner.id, title: `Unreviewed ${w.tag}`, activityType: "WETLAND", boundary: SQUARE }, tx);
      expect(await listProjectReviewers(actor(w.u.ownerAdmin), unreviewed.id, tx)).toEqual([]);
      // a draft project is invisible to everyone outside its organisation
      await expect(listProjectReviewers(actor(w.u.outsider), unreviewed.id, tx)).rejects.toBeInstanceOf(NotFoundError);
    }));
});
