// Without BLOB_READ_WRITE_TOKEN the store is unconfigured, not broken: the evidence route says
// so with a 503 instead of crashing with a 500 and a stack trace.
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

import { GET as evidenceRoute } from "../../src/app/api/evidence/[fileId]/route";
import { evidenceFile } from "../../src/server/db/schema";
import { blobStorage } from "../../src/server/storage/blob";
import { StorageUnavailable } from "../../src/server/storage/port";
import { client, inRollback } from "./db";
import { world } from "./fixtures";

afterAll(() => client.end());

describe("storage without a token", () => {
  it("raises StorageUnavailable, and the evidence route answers 503 for a file the caller may see", () =>
    inRollback(async (tx) => {
      const saved = process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      try {
        await expect(blobStorage.get("any/key")).rejects.toBeInstanceOf(StorageUnavailable);

        h.tx = tx;
        const w = await world(tx);
        const [file] = await tx
          .insert(evidenceFile)
          .values({ submissionId: w.submission.id, role: "BEFORE", storageKey: "k/b.jpg", mime: "image/jpeg", sizeBytes: 1, sha256: "a".repeat(64) })
          .returning();
        h.userId = w.u.ownerMember.id;
        const res = await evidenceRoute(new Request("http://test"), { params: Promise.resolve({ fileId: file!.id }) });
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: "Evidence storage is not configured on this server." });
      } finally {
        h.userId = null;
        if (saved !== undefined) process.env.BLOB_READ_WRITE_TOKEN = saved;
      }
    }));
});
