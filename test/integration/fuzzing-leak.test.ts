// Coordinate fuzzing (docs/13-FEATURE-SPEC.md D5, THREAT_MODEL T5): every public route,
// called with no session, must never carry an exact boundary, a vertex of one, the exact
// centroid, or a location salt. The route handlers are called for real; only the app's
// database client is pointed at this test's rolled-back transaction.
import { afterAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ tx: undefined as unknown }));
vi.mock("../../src/server/db/client", () => ({
  get db() {
    return h.tx;
  },
}));

import { GET as getProjectRoute } from "../../src/app/api/v1/projects/[id]/route";
import { GET as listProjectsRoute } from "../../src/app/api/v1/projects/route";
import { fuzzCentroid, polygonCentroid } from "../../src/lib/geo/fuzz";
import { projectAssignment, projectPrivateLocation } from "../../src/server/db/schema";
import type { GeoPolygon } from "../../src/server/db/schema/types";
import { createProject, getPublicOverview, updateProject } from "../../src/server/services/projects.service";
import { client, inRollback, type Tx } from "./db";
import { actor, addSubmission, world, type World } from "./fixtures";

afterAll(() => client.end());

// Six decimals that appear nowhere else: a substring hit can only be a leak.
const square = (lon: number, lat: number): GeoPolygon => ({
  type: "Polygon",
  coordinates: [[[lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01], [lon, lat + 0.01], [lon, lat]]],
});
const SECRET = square(90.123457, 23.765431);

const listPage = (query: string) => listProjectsRoute(new Request(`http://test/api/v1/projects${query}`));
const getOne = (id: string) => getProjectRoute(new Request(`http://test/api/v1/projects/${id}`), { params: Promise.resolve({ id }) });

async function newProject(tx: Tx, w: World, boundary: GeoPolygon, status: "DRAFT" | "ACTIVE" | "CLOSED") {
  const p = await createProject(actor(w.u.ownerAdmin), { ownerOrgId: w.org.owner.id, title: `Leak ${status}`, activityType: "MANGROVE", boundary }, tx);
  if (status !== "DRAFT") await updateProject(actor(w.u.ownerAdmin), p.id, { status: "ACTIVE" }, tx);
  if (status === "CLOSED") await updateProject(actor(w.u.ownerAdmin), p.id, { status: "CLOSED" }, tx);
  return p;
}

/** Checked against every exact location in the database, seeded rows included. */
async function expectNoLeak(tx: Tx, body: unknown) {
  const json = JSON.stringify(body);
  expect(json).not.toMatch(/boundary|salt|"exact"/i);

  const numbers = new Set<number>();
  JSON.parse(json, (_k, v: unknown) => {
    if (typeof v === "number") numbers.add(v);
    return v;
  });

  for (const loc of await tx.select().from(projectPrivateLocation)) {
    expect(json).not.toContain(loc.locationSalt.toString("hex"));
    const ring = loc.boundary.coordinates[0]!;
    for (const v of [...ring.flat(), ...polygonCentroid(ring)]) expect(numbers.has(v), `exact coordinate ${v} leaked`).toBe(false);
  }
  for (const v of [...SECRET.coordinates[0]!.flat(), ...polygonCentroid(SECRET.coordinates[0]!)]) {
    expect(json).not.toContain(String(v));
  }
}

const scenario = (name: string, fn: (tx: Tx, w: World) => Promise<void>) =>
  it(name, () =>
    inRollback(async (tx) => {
      h.tx = tx;
      await fn(tx, await world(tx));
    }),
  );

describe("public project routes leak no exact location", () => {
  scenario("GET /api/v1/projects, every page: fuzzed point and commitment only, ACTIVE only", async (tx, w) => {
    const active = await newProject(tx, w, SECRET, "ACTIVE");
    const draft = await newProject(tx, w, square(90.223457, 23.865431), "DRAFT");
    const closed = await newProject(tx, w, square(90.323457, 23.965431), "CLOSED");

    // limit=1 forces a page per project, so the cursor path is exercised too
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let pages = 0; pages < 1000; pages++) {
      const res = await listPage(`?limit=1${cursor ? `&cursor=${cursor}` : ""}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toMatch(/^public/);
      const body = (await res.json()) as { items: { id: string }[]; nextCursor: string | null };
      await expectNoLeak(tx, body);
      seen.push(...body.items.map((p) => p.id));
      if (!(cursor = body.nextCursor)) break;
    }

    expect(new Set(seen).size).toBe(seen.length); // no page repeats a project
    expect(seen).toContain(active.id); // the test must see the project, or it proves nothing
    expect(seen).toContain(w.project.id);
    expect(seen).not.toContain(draft.id);
    expect(seen).not.toContain(closed.id);
  });

  scenario("GET /api/v1/projects/[id]: the fuzzed cell centre and the real commitment, nothing exact", async (tx, w) => {
    const p = await newProject(tx, w, SECRET, "ACTIVE");
    const res = await getOne(p.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    await expectNoLeak(tx, body);
    expect(body).toMatchObject({
      id: p.id,
      fuzzedLocation: { type: "Point", coordinates: fuzzCentroid(polygonCentroid(SECRET.coordinates[0]!)) },
      locationCommitment: p.locationCommitment,
      ownerOrgName: w.org.owner.name,
    });
  });

  scenario("a DRAFT, CLOSED, unknown or malformed id is a 404 with nothing in it", async (tx, w) => {
    const draft = await newProject(tx, w, square(90.223457, 23.865431), "DRAFT");
    const closed = await newProject(tx, w, square(90.323457, 23.965431), "CLOSED");
    for (const id of [draft.id, closed.id, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      const res = await getOne(id);
      expect(res.status).toBe(404);
      await expectNoLeak(tx, await res.json());
    }
  });

  scenario("getPublicOverview counts ACTIVE sites, their approved records and distinct verifier orgs only", async (tx, w) => {
    const before = await getPublicOverview(tx);
    const add = (projectId: string, status: "APPROVED" | "ANCHORED" | "REJECTED" | "IN_REVIEW") =>
      addSubmission(tx, { projectId, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status });
    await add(w.project.id, "APPROVED");
    await add(w.project.id, "ANCHORED");
    await add(w.project.id, "REJECTED");
    const second = await newProject(tx, w, square(90.523457, 23.565431), "ACTIVE");
    await tx.insert(projectAssignment).values({ projectId: second.id, verifierOrgId: w.org.rival.id, assignedByUserId: w.u.platformAdmin.id });
    const draft = await newProject(tx, w, square(90.223457, 23.865431), "DRAFT");
    await add(draft.id, "APPROVED"); // not public: its project is not ACTIVE
    await tx.insert(projectAssignment).values({ projectId: draft.id, verifierOrgId: w.org.funder.id, assignedByUserId: w.u.platformAdmin.id });

    expect(await getPublicOverview(tx)).toEqual({ sites: before.sites + 1, approved: before.approved + 2, verifierOrgs: before.verifierOrgs + 1 });
  });

  scenario("the page size is capped and a bad cursor is refused, not ignored", async () => {
    expect((await listPage("?limit=101")).status).toBe(422);
    expect((await listPage("?limit=0")).status).toBe(422);
    expect((await listPage("?cursor=not-a-uuid")).status).toBe(422);
  });
});
