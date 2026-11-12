// The public proof read behind /proof/[id] (docs/05-ROUTES.md §4): only APPROVED or ANCHORED
// submissions exist there; everything in it is a real row; nothing in it is the exact site.
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { evidenceFile, evidenceSubmission, projectPrivateLocation, reviewDecision } from "../../src/server/db/schema";
import { NotFoundError, ValidationError } from "../../src/server/services/errors";
import { getPublicProof, lookupProofs } from "../../src/server/services/submissions.service";
import { client, inRollback } from "./db";
import { world } from "./fixtures";

afterAll(() => client.end());

const SHA = (c: string) => c.repeat(64);

describe("lookupProofs (/verify, docs/16 A7)", () => {
  it("finds an approved record by proof id or by a file's SHA-256, and nothing that is not approved", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const s = w.submission;
      await tx.insert(evidenceFile).values({ submissionId: s.id, role: "AFTER", storageKey: "k/x.jpg", mime: "image/jpeg", sizeBytes: 10, sha256: SHA("c") });

      // in review: not a proof yet, by either key
      expect(await lookupProofs(SHA("c"), tx)).toEqual([]);
      expect(await lookupProofs(s.id, tx)).toEqual([]);

      await tx.update(evidenceSubmission).set({ status: "APPROVED" }).where(eq(evidenceSubmission.id, s.id));
      const hit = { submissionId: s.id, projectTitle: w.project.title, status: "APPROVED" };
      expect(await lookupProofs(`  ${SHA("c").toUpperCase()} `, tx)).toEqual([{ ...hit, matchedBy: "FILE_SHA256" }]);
      expect(await lookupProofs(s.id, tx)).toEqual([{ ...hit, matchedBy: "PROOF_ID" }]);
      // a transaction hash is a real query; nothing is anchored, so nothing matches
      expect(await lookupProofs(`0x${SHA("d")}`, tx)).toEqual([]);
      await expect(lookupProofs("mangroves", tx)).rejects.toBeInstanceOf(ValidationError);
    }));
});

describe("getPublicProof", () => {
  it("is a 404 until the submission is approved, then shows its real files and decisions and never the site", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const s = w.submission;
      await tx.insert(evidenceFile).values([
        { submissionId: s.id, role: "BEFORE", storageKey: "k/b.jpg", mime: "image/jpeg", sizeBytes: 10, sha256: SHA("a") },
        { submissionId: s.id, role: "AFTER", storageKey: "k/a.jpg", mime: "image/jpeg", sizeBytes: 10, sha256: SHA("b") },
      ]);
      const reason = "Both photos show the same plot; the planted rows are visible in the after photo.";
      await tx.insert(reviewDecision).values([
        { submissionId: s.id, round: 1, reviewerUserId: w.u.v1.id, reviewerOrgId: w.org.verifier.id, decision: "APPROVE", reason },
        { submissionId: s.id, round: 1, reviewerUserId: w.u.v2.id, reviewerOrgId: w.org.verifier.id, decision: "APPROVE", reason },
      ]);

      // IN_REVIEW, and ids that are not submissions at all: one 404
      for (const id of [s.id, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
        await expect(getPublicProof(id, tx)).rejects.toBeInstanceOf(NotFoundError);
      }

      await tx.update(evidenceSubmission).set({ status: "APPROVED" }).where(eq(evidenceSubmission.id, s.id));
      const proof = await getPublicProof(s.id, tx);
      expect(proof.submission).toMatchObject({ id: s.id, status: "APPROVED", anchored: false });
      expect(proof.project).toMatchObject({ id: w.project.id, title: w.project.title, ownerOrgName: w.org.owner.name });
      expect(proof.files.map((f) => [f.role, f.sha256])).toEqual([["BEFORE", SHA("a")], ["AFTER", SHA("b")]]);
      expect(proof.decisions.map((d) => [d.decision, d.reviewerOrgName, d.reason])).toEqual([
        ["APPROVE", w.org.verifier.name, reason],
        ["APPROVE", w.org.verifier.name, reason],
      ]);

      // nothing of the exact site, nobody's personal identity, no storage path
      const [loc] = await tx.select().from(projectPrivateLocation).where(eq(projectPrivateLocation.projectId, w.project.id));
      const text = JSON.stringify(proof);
      for (const secret of [loc!.locationSalt.toString("hex"), JSON.stringify(loc!.boundary.coordinates[0]![0]), w.u.v1.id, w.u.v1.email, "k/b.jpg"]) {
        expect(text).not.toContain(secret);
      }
    }));
});
