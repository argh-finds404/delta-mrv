// What the seed adds on top of its bulk history, on a fresh database and on one seeded earlier
// (every step is idempotent, because the seed can never be wiped and re-run):
//
//   1. seals a canonical manifest on every approved record that lacks one, so it can be anchored
//   2. four hand-made records at the Sundarbans and Sylhet sites, one per state worth showing:
//        IN_REVIEW   Koyra, Khulna        its after photo is a re-encoded copy of a photo already
//                                         submitted for another project: a HIGH duplicate finding
//        ESCALATED   Tanguar Haor, Sylhet one approval, one rejection, waiting for a deciding vote
//        APPROVED    one at each site     approved today and sealed, waiting for the next batch
//   3. with LOCAL_STORAGE_DIR set, writes every seed image there, so the Lab shows real photos
//
// ANCHORED is the one state a seed cannot write honestly: it exists when a chain holds the batch.
// Run anchoring once (pnpm dev:local does, against a local chain) and the sealed history moves.
//
// Plain SQL, like the rest of the seed: scripts may not import src/server. The manifest and the
// hashes come from the same src/lib code the services use.
import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type postgres from "postgres";
import sharp from "sharp";
import { buildManifest, manifestHash, type ManifestRole } from "../../src/lib/crypto/manifest";
import { hammingDistance } from "../../src/lib/forensics/dhash";
import { describeImage, makePool, synthPhoto } from "./seed-pool";

type Sql = postgres.Sql;
const MARK = "seed/narrative/";
// forensics.service.ts: the rule version, the threshold and the wording of the finding it would write
const RULE_VERSION = "forensics.v1";
const PERCEPTUAL_THRESHOLD = 8;
const SAME_ORG_REASON = "A near-identical photo was already submitted by the same organisation for a different project. It may be one photograph supporting two claims.";

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, (i + 1) * n));

/** Seals every approved record that has files, two approvals and no manifest yet. */
async function sealApproved(sql: Sql): Promise<number> {
  const rows = await sql<{ id: string; project_id: string; owner_org_id: string; round: number; commitment: string | null; lon: number | null; lat: number | null }[]>`
    select s.id, s.project_id, s.owner_org_id, s.round, p.location_commitment as commitment,
           ST_X(p.fuzzed_centroid::geometry)::float8 as lon, ST_Y(p.fuzzed_centroid::geometry)::float8 as lat
    from evidence_submission s join impact_project p on p.id = s.project_id
    where s.status = 'APPROVED' and s.manifest_hash is null`;
  if (!rows.length) return 0;

  let sealed = 0;
  for (const part of chunks(rows, 500)) {
    const ids = part.map((r) => r.id);
    const files = await sql<{ submission_id: string; role: ManifestRole; round: number; sha256: string; dhash: string | null }[]>`
      select submission_id, role, round, sha256, dhash::text as dhash from evidence_file where submission_id in ${sql(ids)}`;
    const approvals = await sql<{ id: string; submission_id: string; round: number; reviewer_org_id: string; created_at: Date }[]>`
      select id, submission_id, round, reviewer_org_id, created_at from review_decision
      where decision = 'APPROVE' and submission_id in ${sql(ids)} order by created_at, id`;

    const updates: [string, string, string][] = [];
    for (const r of part) {
      const mine = files.filter((f) => f.submission_id === r.id);
      const votes = approvals.filter((a) => a.submission_id === r.id && a.round === r.round);
      const last = votes.at(-1);
      if (!mine.length || !last) continue;
      const manifest = buildManifest({
        submissionId: r.id,
        projectId: r.project_id,
        ownerOrgId: r.owner_org_id,
        verifierOrgId: last.reviewer_org_id,
        files: mine.map(({ role, round, sha256, dhash }) => ({ role, round, sha256, dhash })),
        locationCommitment: r.commitment,
        fuzzedLocation: r.lon === null || r.lat === null ? null : { type: "Point", coordinates: [r.lon, r.lat] },
        approvedAtIso: last.created_at.toISOString(),
        quorumReviewIds: votes.map((v) => v.id),
        // the seed writes no audit events, so there is no chain head for a seeded approval to bind
        orgAuditChainHead: null,
      });
      updates.push([r.id, JSON.stringify(manifest), await manifestHash(manifest)]);
    }
    if (updates.length) {
      await sql`update evidence_submission s set manifest = v.manifest::jsonb, manifest_hash = v.hash
                from (values ${sql(updates)}) as v(id, manifest, hash) where s.id = v.id::uuid`;
      sealed += updates.length;
    }
  }
  return sealed;
}

async function narrative(sql: Sql, images: Awaited<ReturnType<typeof narrativeImages>>): Promise<boolean> {
  const [{ n }] = (await sql`select count(*)::int as n from evidence_file where storage_key like ${`${MARK}%`}`) as unknown as [{ n: number }];
  if (n > 0) return false;

  const one = async <T>(q: Promise<T[]>, what: string) => {
    const [row] = await q;
    if (!row) throw new Error(`the seed's ${what} is missing: run the base seed first`);
    return row;
  };
  const owner = await one(sql<{ id: string }[]>`select id from organization where slug = 'sundarbans-restoration-trust'`, "owner organisation");
  const verifier = await one(sql<{ id: string }[]>`select id from organization where slug = 'delta-independent-audit'`, "verifier organisation");
  const user = async (email: string) => (await one(sql<{ id: string }[]>`select id from "user" where email = ${email}`, `user ${email}`)).id;
  const [submitter, v1, v2] = [await user("submitter@delta-demo.example"), await user("verifier1@delta-demo.example"), await user("verifier2@delta-demo.example")];
  const project = async (title: string) => (await one(sql<{ id: string }[]>`select id from impact_project where title = ${title}`, `project ${title}`)).id;
  const [koyra, tanguar] = [await project("Koyra Mangrove Belt, Khulna"), await project("Tanguar Haor Wetland Margin, Sunamganj")];

  const now = Date.now();
  const hours = (h: number) => new Date(now - h * 3_600_000);
  const { fresh, copy, original } = images;

  type Vote = [who: string, decision: "APPROVE" | "REJECT", reason: string, at: Date];
  const records: { project: string; status: string; at: Date; before: (typeof fresh)[number]; after: (typeof fresh)[number]; votes: Vote[] }[] = [
    { project: koyra, status: "IN_REVIEW", at: hours(20), before: fresh[0]!, after: copy, votes: [] },
    {
      project: tanguar,
      status: "ESCALATED",
      at: hours(52),
      before: fresh[1]!,
      after: fresh[2]!,
      votes: [
        [v1, "APPROVE", "The embankment line and the replanted margin are visible in the after photo, taken from the same bank.", hours(30)],
        [v2, "REJECT", "The two photos are framed from different banks; I cannot confirm they show the same stretch of the margin.", hours(26)],
      ],
    },
    {
      project: koyra,
      status: "APPROVED",
      at: hours(9),
      before: fresh[3]!,
      after: fresh[4]!,
      votes: [
        [v1, "APPROVE", "Same creek mouth in both frames; the planted rows are visible along the mudflat in the after photo.", hours(3)],
        [v2, "APPROVE", "Before and after match on the tree line and the embankment; the new saplings are clearly staked.", hours(2)],
      ],
    },
    {
      project: tanguar,
      status: "APPROVED",
      at: hours(8),
      before: fresh[5]!,
      after: fresh[6]!,
      votes: [
        [v1, "APPROVE", "The cleared margin and the new swamp-forest planting are both visible from the same vantage point.", hours(2.5)],
        [v2, "APPROVE", "Consistent pair for the wetland margin; nothing in the findings contradicts the claim.", hours(1.5)],
      ],
    },
  ];

  await sql.begin(async (tx) => {
    for (const r of records) {
      const id = randomUUID();
      await tx`insert into evidence_submission (id, project_id, submitted_by_user_id, owner_org_id, status, round, submitted_at)
               values (${id}, ${r.project}, ${submitter}, ${owner.id}, ${r.status}, 1, ${r.at})`;
      const fileIds = { BEFORE: randomUUID(), AFTER: randomUUID() };
      for (const [role, img] of [["BEFORE", r.before], ["AFTER", r.after]] as const) {
        await tx`insert into evidence_file (id, submission_id, role, storage_key, mime, size_bytes, sha256, client_sha256, dhash, round, created_at)
                 values (${fileIds[role]}, ${id}, ${role}, ${img.key}, 'image/jpeg', ${img.bytes}, ${img.sha256}, ${img.sha256}, ${img.dhash}, 1, ${r.at})`;
      }
      for (const [who, decision, reason, at] of r.votes) {
        await tx`insert into review_decision (submission_id, round, reviewer_user_id, reviewer_org_id, decision, reason, created_at)
                 values (${id}, 1, ${who}, ${verifier.id}, ${decision}, ${reason}, ${at})`;
      }
      if (r.after === copy) {
        // what the forensics pass writes for this pair: the nearest earlier match, by real Hamming distance
        const [match] = await tx<{ id: string }[]>`select id from evidence_file where sha256 = ${original.sha256} order by created_at, id limit 1`;
        const key = process.env.FORENSICS_MATCH_KEY;
        const matchRef = match && key ? `mr_${createHmac("sha256", key).update(`delta/forensics/matchRef/v1/${match.id}`).digest("hex").slice(0, 32)}` : undefined;
        const evidence = { distance: hammingDistance(copy.dhash, original.dhash), threshold: PERCEPTUAL_THRESHOLD, ...(matchRef ? { matchRef } : {}), ruleVersion: RULE_VERSION };
        await tx`insert into forensic_finding (submission_id, evidence_file_id, kind, severity, reason, evidence, rule_version)
                 values (${id}, ${fileIds.AFTER}, 'PERCEPTUAL_MATCH_SAME_ORG', 'HIGH', ${SAME_ORG_REASON}, ${tx.json(evidence)}, ${RULE_VERSION})`;
      }
    }
  });
  return true;
}

/** Seven new photos, and one that is a pool photo re-encoded smaller: a different file, the same picture. */
async function narrativeImages(pool: Awaited<ReturnType<typeof makePool>>) {
  const fresh = await Promise.all(Array.from({ length: 7 }, (_, k) => synthPhoto(2000 + k, `${MARK}site-${k}.jpg`)));
  // pool photo 2 is used only by the Buriganga and Sonadia history, so at Koyra it is another project's photo
  const original = pool[2]!;
  const copy = await describeImage(`${MARK}reused.jpg`, await sharp(original.jpeg).resize(88, 66).jpeg({ quality: 70 }).toBuffer());
  const distance = hammingDistance(copy.dhash, original.dhash);
  if (copy.sha256 === original.sha256 || distance >= PERCEPTUAL_THRESHOLD) throw new Error(`the re-encoded photo must be a near-duplicate (Hamming < ${PERCEPTUAL_THRESHOLD}), got ${distance}`);
  for (const f of fresh) for (const p of pool) if (hammingDistance(f.dhash, p.dhash) < 16) throw new Error(`${f.key} is too similar to ${p.key}`);
  return { fresh, copy, original };
}

export async function topUp(sql: Sql): Promise<void> {
  const pool = await makePool();
  const images = await narrativeImages(pool);
  const added = await narrative(sql, images);
  const sealed = await sealApproved(sql);

  const dir = process.env.LOCAL_STORAGE_DIR;
  if (dir) {
    for (const img of [...pool, ...images.fresh, images.copy]) {
      const file = join(dir, img.key);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, img.jpeg);
    }
  }
  console.log(`narrative records ${added ? "added (4)" : "already there"} | manifests sealed ${sealed}${dir ? ` | seed photos written to ${dir}` : ""}`);
}
