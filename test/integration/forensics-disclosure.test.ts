// #8 (docs/10-FORENSICS.md §4): the duplicate search is global, the disclosure is not. A match
// in another organisation tells the submitter and the reviewer THAT it exists and how close it
// is, never which organisation, project, submission or file. Checked on the stored rows and
// on every payload an unprivileged caller can reach: services and the HTTP routes.
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";
import { evidenceFile, forensicFinding, member } from "../../src/server/db/schema";
import { runForensics } from "../../src/server/services/forensics.service";
import { createProject, updateProject } from "../../src/server/services/projects.service";
import { reviewQueueOverview } from "../../src/server/services/reviews.service";
import { createDraft, finalizeSubmission, getSubmission, issueUploadToken, listFindings } from "../../src/server/services/submissions.service";
import { GET as findingsRoute } from "../../src/app/api/submissions/[id]/findings/route";
import { GET as queueRoute } from "../../src/app/api/lab/queue/route";
import { synthetic } from "../fixtures/forensics/images";
import { client, inRollback, type Tx } from "./db";
import { actor, SQUARE, world, type World } from "./fixtures";
import { memoryStorage } from "./memory-storage";

const h = vi.hoisted(() => ({ tx: null as unknown, userId: null as string | null }));
vi.mock("../../src/server/db/client", () => ({
  get db() {
    return h.tx;
  },
}));
vi.mock("../../src/server/auth/session", () => ({
  getSession: async () => (h.userId ? { user: { id: h.userId } } : null),
}));

process.env.FORENSICS_MATCH_KEY = "test-forensics-match-key-of-at-least-32-chars";
afterAll(() => client.end());

type Store = ReturnType<typeof memoryStorage>;

async function submitPair(tx: Tx, store: Store, who: { id: string }, projectId: string, before: Buffer, after: Buffer) {
  const draft = await createDraft(actor(who), projectId, tx);
  const b = await issueUploadToken(actor(who), draft.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
  const a = await issueUploadToken(actor(who), draft.id, { role: "AFTER", contentType: "image/jpeg" }, tx, store.port);
  store.put(b.pathname, before);
  store.put(a.pathname, after);
  await finalizeSubmission(actor(who), draft.id, { files: [{ role: "BEFORE", pathname: b.pathname }, { role: "AFTER", pathname: a.pathname }] }, tx, store.port);
  await tx.update(evidenceFile).set({ createdAt: sql`now() - interval '1 hour'` }).where(eq(evidenceFile.submissionId, draft.id));
  return draft.id;
}

/** Every identifier of the earlier submission in `org`: what must never reach a stranger. */
async function identifiersOf(tx: Tx, w: World, org: "owner" | "other", submissionId: string, project: { id: string; title: string }) {
  const files = await tx.select({ id: evidenceFile.id, key: evidenceFile.storageKey }).from(evidenceFile).where(eq(evidenceFile.submissionId, submissionId));
  const o = w.org[org];
  return [project.id, project.title, submissionId, ...files.flatMap((f) => [f.id, f.key]), ...(org === "other" ? [o.id, o.name, o.slug] : [])];
}

describe("cross-organisation disclosure", () => {
  it("names a match only by an opaque matchRef, in the stored rows and in every reachable payload", () =>
    inRollback(async (tx) => {
      h.tx = tx;
      const store = memoryStorage();
      const w = await world(tx);
      const img = await synthetic(7100);
      const near = await sharp(img).jpeg({ quality: 50 }).toBuffer();

      // the earlier claims: one by an unrelated organisation, one by the same organisation on another project
      await tx.update(member).set({ role: "admin" }).where(eq(member.userId, w.u.outsider.id));
      const theirs = await createProject(actor(w.u.outsider), { ownerOrgId: w.org.other.id, title: `Their site ${w.tag}`, activityType: "MANGROVE", boundary: SQUARE }, tx);
      await updateProject(actor(w.u.outsider), theirs.id, { status: "ACTIVE" }, tx);
      const theirSubmission = await submitPair(tx, store, w.u.outsider, theirs.id, img, await synthetic(7101));
      const sibling = await createProject(actor(w.u.ownerAdmin), { ownerOrgId: w.org.owner.id, title: `Sibling site ${w.tag}`, activityType: "MANGROVE", boundary: SQUARE }, tx);
      await updateProject(actor(w.u.ownerAdmin), sibling.id, { status: "ACTIVE" }, tx);
      const siblingSubmission = await submitPair(tx, store, w.u.ownerMember, sibling.id, img, await synthetic(7102));

      // the new claim: the same photo, and a re-compressed copy of it
      const draft = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
      const b = await issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
      const a = await issueUploadToken(actor(w.u.ownerMember), draft.id, { role: "AFTER", contentType: "image/jpeg" }, tx, store.port);
      store.put(b.pathname, img);
      store.put(a.pathname, near);
      await finalizeSubmission(actor(w.u.ownerMember), draft.id, { files: [{ role: "BEFORE", pathname: b.pathname }, { role: "AFTER", pathname: a.pathname }] }, tx, store.port);
      await runForensics(draft.id, 1, tx, store.port);

      const stored = await tx.select().from(forensicFinding).where(eq(forensicFinding.submissionId, draft.id));
      const kinds = stored.map((f) => f.kind);
      // the matches really were found: otherwise this test would pass by finding nothing
      expect(kinds).toEqual(expect.arrayContaining(["EXACT_DUPLICATE_OTHER_ORG", "PERCEPTUAL_MATCH_OTHER_ORG", "EXACT_DUPLICATE_SAME_ORG", "PERCEPTUAL_MATCH_SAME_ORG"]));
      const refs = stored.flatMap((f) => ((f.evidence as { matchRef?: string }).matchRef ? [(f.evidence as { matchRef: string }).matchRef] : []));
      expect(refs.length).toBe(4);
      for (const r of refs) expect(r).toMatch(/^mr_[0-9a-f]{32}$/);

      const theirIds = await identifiersOf(tx, w, "other", theirSubmission, theirs);
      const siblingIds = await identifiersOf(tx, w, "owner", siblingSubmission, sibling);
      const leaks = (payload: unknown, forbidden: string[]) => {
        const text = JSON.stringify(payload);
        return forbidden.filter((id) => text.includes(id));
      };

      // the rows themselves carry no identifier of either earlier claim
      expect(leaks(stored, [...theirIds, ...siblingIds])).toEqual([]);

      // the submitter's organisation and the assigned verifiers, through services and routes
      const callers = [w.u.ownerMember, w.u.ownerAdmin, w.u.v1, w.u.vAdmin];
      for (const who of callers) {
        // the owner org knows its own sibling project; nobody outside it learns that one either
        const forbidden = who === w.u.ownerMember || who === w.u.ownerAdmin ? theirIds : [...theirIds, ...siblingIds];
        h.userId = who.id;
        const payloads = [
          await listFindings(actor(who), draft.id, tx),
          await getSubmission(actor(who), draft.id, tx),
          await reviewQueueOverview(actor(who), 100, tx),
          await (await findingsRoute(new Request("http://test"), { params: Promise.resolve({ id: draft.id }) })).json(),
          await (await queueRoute()).json(),
        ];
        expect(leaks(payloads, forbidden), `leaked to ${who.name}`).toEqual([]);
      }
      h.userId = null;
    }));
});
