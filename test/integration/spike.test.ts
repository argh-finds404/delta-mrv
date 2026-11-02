import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  anchorBatch,
  anchorLeaf,
  auditEvent,
  evidenceFile,
  evidenceSubmission,
  impactProject,
  projectPrivateLocation,
  reviewDecision,
} from "../../src/server/db/schema";
import type { GeoPolygon } from "../../src/server/db/schema/types";
import { client, inRollback, pgError, seedOrgAndUser, type Tx } from "./db";

afterAll(() => client.end());

// ~1 km square near Dhaka, counter-clockwise: lon 90.40..90.41, lat 23.80..23.81.
const BOUNDARY: GeoPolygon = {
  type: "Polygon",
  coordinates: [[[90.4, 23.8], [90.41, 23.8], [90.41, 23.81], [90.4, 23.81], [90.4, 23.8]]],
};
const INSIDE = [90.405, 23.805] as const;
const VERTEX = [90.4, 23.8] as const; // a corner of BOUNDARY
const JUST_OUTSIDE = [90.4105, 23.805] as const; // ~51 m east of the east edge
const FAR_OUTSIDE = [91.5, 24.5] as const;

const point = ([lon, lat]: readonly [number, number]) =>
  sql`ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography`;

async function seedProject(tx: Tx) {
  const { org, usr } = await seedOrgAndUser(tx);
  const [project] = await tx
    .insert(impactProject)
    .values({
      ownerOrgId: org.id,
      title: "Spike project",
      activityType: "MANGROVE",
      fuzzedCentroid: { type: "Point", coordinates: [90.405, 23.805] },
    })
    .returning();
  return { org, usr, project: project! };
}

describe("spike 1: geography(Polygon,4326) through Drizzle", () => {
  it("answers ST_Covers and ST_DWithin correctly for inside / on the boundary / just outside / far outside", () =>
    inRollback(async (tx) => {
      const { project } = await seedProject(tx);
      await tx.insert(projectPrivateLocation).values({
        projectId: project.id,
        boundary: BOUNDARY,
        locationSalt: Buffer.alloc(32, 7),
      });

      const probe = async (p: readonly [number, number]) => {
        const [row] = await tx.execute<{ covers: boolean; within100: boolean; metres: number }>(sql`
          select
            ST_Covers(boundary, ${point(p)})       as covers,
            ST_DWithin(boundary, ${point(p)}, 100) as within100,
            ST_Distance(boundary, ${point(p)})     as metres
          from project_private_location where project_id = ${project.id}`);
        return row!;
      };

      const inside = await probe(INSIDE);
      expect(inside).toMatchObject({ covers: true, within100: true, metres: 0 });

      // A vertex lies exactly on the boundary: a geofence must count it as inside.
      const onEdge = await probe(VERTEX);
      expect(onEdge).toMatchObject({ covers: true, within100: true, metres: 0 });

      const near = await probe(JUST_OUTSIDE);
      expect(near).toMatchObject({ covers: false, within100: true });
      expect(near.metres).toBeGreaterThan(40);
      expect(near.metres).toBeLessThan(60);

      const far = await probe(FAR_OUTSIDE);
      expect(far).toMatchObject({ covers: false, within100: false });
      expect(far.metres).toBeGreaterThan(50_000);
    }));

  it("round-trips geography through the custom types (EWKB parser against real PostGIS output)", () =>
    inRollback(async (tx) => {
      const { project } = await seedProject(tx);
      await tx.insert(projectPrivateLocation).values({
        projectId: project.id,
        boundary: BOUNDARY,
        locationSalt: Buffer.alloc(32, 7),
      });

      const [loc] = await tx.select().from(projectPrivateLocation);
      expect(loc!.boundary).toEqual(BOUNDARY);
      expect(loc!.locationSalt).toEqual(Buffer.alloc(32, 7));

      const [proj] = await tx.select().from(impactProject);
      expect(proj!.fuzzedCentroid).toEqual({ type: "Point", coordinates: [90.405, 23.805] });
    }));

  it("keeps the geography typmod (Point/Polygon, SRID 4326)", () =>
    inRollback(async (tx) => {
      const rows = await tx.execute<{ col: string; type: string; srid: number }>(sql`
        select f_table_name || '.' || f_geography_column as col, type, srid
        from geography_columns where f_table_schema = 'public' order by 1`);
      expect(rows.map((r) => [r.col, r.type, r.srid])).toEqual([
        ["evidence_file.gps", "Point", 4326],
        ["impact_project.fuzzed_centroid", "Point", 4326],
        ["project_private_location.boundary", "Polygon", 4326],
      ]);
    }));
});

describe("spike 2: bit(64) Hamming distance through Drizzle", () => {
  const BASE = "1010".repeat(16);
  /** BASE with its first n bits flipped: Hamming distance from BASE is exactly n. */
  const flip = (n: number) =>
    [...BASE].map((b, i) => (i < n ? (b === "1" ? "0" : "1") : b)).join("");

  async function seedHashes(tx: Tx) {
    const { org, usr, project } = await seedProject(tx);
    const [sub] = await tx
      .insert(evidenceSubmission)
      .values({ projectId: project.id, submittedByUserId: usr.id, ownerOrgId: org.id })
      .returning();
    const dist = [0, 3, 7, 8, 20, 64];
    await tx.insert(evidenceFile).values([
      ...dist.map((d) => ({
        submissionId: sub!.id,
        role: "SUPPLEMENT" as const,
        storageKey: `spike/${d}`,
        mime: "image/jpeg",
        sizeBytes: 1,
        sha256: String(d).padStart(64, "0"),
        dhash: flip(d),
      })),
      // dhash is nullable: an un-hashed file must never match
      { submissionId: sub!.id, role: "SUPPLEMENT" as const, storageKey: "spike/null", mime: "image/jpeg", sizeBytes: 1, sha256: "f".repeat(64), dhash: null },
    ]);
  }

  it("returns exactly the rows below Hamming distance 8, nearest first", () =>
    inRollback(async (tx) => {
      await seedHashes(tx);
      const rows = await tx.execute<{ storage_key: string; d: number }>(sql`
        select storage_key, (dhash <~> ${BASE}::bit(64)) as d
        from evidence_file
        where dhash <~> ${BASE}::bit(64) < 8
        order by d, storage_key`);
      expect(rows.map((r) => [r.storage_key, Number(r.d)])).toEqual([
        ["spike/0", 0],
        ["spike/3", 3],
        ["spike/7", 7],
      ]);
    }));

  it("reads bit(64) back as the same 64-character string", () =>
    inRollback(async (tx) => {
      await seedHashes(tx);
      const rows = await tx.select({ k: evidenceFile.storageKey, h: evidenceFile.dhash }).from(evidenceFile);
      expect(rows.find((r) => r.k === "spike/3")!.h).toBe(flip(3));
      expect(rows.find((r) => r.k === "spike/null")!.h).toBeNull();
    }));

  it("lets the planner use the HNSW bit_hamming_ops index for nearest-neighbour order", () =>
    inRollback(async (tx) => {
      await seedHashes(tx);
      // A seven-row table seq-scans by choice; force the index to prove it is usable.
      await tx.execute(sql`set local enable_seqscan = off`);
      const plan = await tx.execute<{ "QUERY PLAN": string }>(sql`
        explain select id from evidence_file order by dhash <~> ${BASE}::bit(64) limit 5`);
      expect(plan.map((r) => r["QUERY PLAN"]).join("\n")).toContain("evidence_file_dhash_hnsw");
    }));
});

describe("spike 3: append-only tables refuse UPDATE, DELETE and TRUNCATE", () => {
  async function seedSubmission(tx: Tx) {
    const { org, usr, project } = await seedProject(tx);
    const [sub] = await tx
      .insert(evidenceSubmission)
      .values({ projectId: project.id, submittedByUserId: usr.id, ownerOrgId: org.id })
      .returning();
    return { org, usr, sub: sub! };
  }

  // Each seed inserts one row inside the test's transaction and returns its id.
  const APPEND_ONLY: { table: string; seed: (tx: Tx) => Promise<string> }[] = [
    {
      table: "audit_event",
      seed: async (tx) => {
        const { org } = await seedOrgAndUser(tx);
        const [row] = await tx
          .insert(auditEvent)
          .values({
            orgId: org.id,
            seq: 1,
            eventType: "spike",
            payload: {},
            prevEventHash: "0".repeat(64),
            eventHash: "a".repeat(64),
          })
          .returning();
        return row!.id;
      },
    },
    {
      table: "review_decision",
      seed: async (tx) => {
        const { org, usr, sub } = await seedSubmission(tx);
        const [row] = await tx
          .insert(reviewDecision)
          .values({
            submissionId: sub.id,
            round: 1,
            reviewerUserId: usr.id,
            reviewerOrgId: org.id,
            decision: "APPROVE",
            reason: "Spike: twenty characters or more.",
          })
          .returning();
        return row!.id;
      },
    },
    {
      table: "anchor_leaf",
      seed: async (tx) => {
        const { sub } = await seedSubmission(tx);
        const [batch] = await tx
          .insert(anchorBatch)
          .values({
            merkleRoot: "0x" + "b".repeat(64),
            chainId: 84532,
            contractAddress: "0x" + "c".repeat(40),
            leafCount: 1,
          })
          .returning();
        const [row] = await tx
          .insert(anchorLeaf)
          .values({
            batchId: batch!.id,
            submissionId: sub.id,
            manifestHash: "d".repeat(64),
            manifestVersion: 1,
            leafIndex: 0,
            proof: [],
          })
          .returning();
        return row!.id;
      },
    },
  ];

  describe.each(APPEND_ONLY)("$table", ({ table, seed }) => {
    const immutable = new RegExp(`append-only table: ${table} is immutable`);
    const tbl = sql.raw(table);

    it("INSERT still works", () =>
      inRollback(async (tx) => {
        expect(await seed(tx)).toBeTruthy();
      }));

    it("a direct UPDATE raises", () =>
      inRollback(async (tx) => {
        const id = await seed(tx);
        expect(await pgError(tx.execute(sql`update ${tbl} set id = id where id = ${id}`))).toMatch(immutable);
      }));

    it("a direct DELETE raises", () =>
      inRollback(async (tx) => {
        const id = await seed(tx);
        expect(await pgError(tx.execute(sql`delete from ${tbl} where id = ${id}`))).toMatch(immutable);
      }));

    it("TRUNCATE raises", () =>
      inRollback(async (tx) => {
        expect(await pgError(tx.execute(sql`truncate ${tbl}`))).toMatch(immutable);
      }));
  });
});
