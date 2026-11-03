// Demo data (docs/11-IMPLEMENTATION.md Stage 2): three organisations, four Bangladesh
// projects, three verifier users, and 5,200 historical submissions that reuse a pool of
// eight images. Plain SQL on purpose: scripts may not import src/server (it imports
// server-only), and a seed that bypassed the services is the price.
//
//   pnpm db:seed
//
// Refuses to run against production, and refuses to run twice: review_decision is
// append-only, so a seeded database cannot be wiped. Recreate the branch to reseed.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";
import sharp from "sharp";
import { locationCommitment } from "../src/lib/crypto/location";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { DHASH_RESIZE, hammingDistance, packDHash } from "../src/lib/forensics/dhash";
import { fuzzCentroid, polygonCentroid, type LonLat } from "../src/lib/geo/fuzz";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: the environment must already be set
}
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");
const dbUrl: string = url;
if (!process.env.NEON_BRANCH || process.env.NEON_BRANCH === "production") {
  throw new Error(`refusing to seed: NEON_BRANCH is "${process.env.NEON_BRANCH ?? ""}"`);
}

type Row = Record<string, unknown>;
const SUBMISSIONS = 5200;

// ---- deterministic randomness ------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261102);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]!;

// ---- the image pool ----------------------------------------------------------------------
// Eight synthetic photos. Hashes are real: sha256 of the bytes, dHash by the §4.2 pipeline
// (grayscale first, then DHASH_RESIZE: 9x8, lanczos3, named in the contract). Stage 4 moves the
// sharp half into the forensics service; DHASH_RESIZE and packDHash are the shared parts.
async function makePool() {
  const pool: { key: string; bytes: number; sha256: string; dhash: string }[] = [];
  for (let k = 0; k < 8; k++) {
    const r = mulberry32(1000 + k);
    const [W, H, B] = [96, 72, 8];
    const raw = Buffer.alloc(W * H * 3);
    const blocks = Array.from({ length: (W / B) * (H / B) }, () => [r() * 255, r() * 255, r() * 255]);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        for (let c = 0; c < 3; c++)
          raw[(y * W + x) * 3 + c] = Math.round(blocks[Math.floor(y / B) * (W / B) + Math.floor(x / B)]![c]!);
    const jpeg = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
    const { data, info } = await sharp(jpeg).grayscale().resize(DHASH_RESIZE).raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 1) throw new Error(`expected 1 channel after grayscale, got ${info.channels}`);
    pool.push({
      key: `seed/pool/${k}.jpg`,
      bytes: jpeg.length,
      sha256: createHash("sha256").update(jpeg).digest("hex"),
      dhash: packDHash(new Uint8Array(data)),
    });
  }
  // The pool must not look like near-duplicates of itself, or Stage 4's duplicate demo is noise.
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      if (hammingDistance(pool[i]!.dhash, pool[j]!.dhash) < 16) throw new Error(`pool images ${i} and ${j} are too similar`);
  return pool;
}

// ---- what gets seeded --------------------------------------------------------------------
// Hand-drawn approximations at real places. They are NOT surveyed boundaries.
const PROJECTS = [
  { title: "Koyra Mangrove Belt, Khulna", type: "MANGROVE", qty: 12000, unit: "saplings", ring: [[89.3, 22.34], [89.322, 22.34], [89.322, 22.358], [89.3, 22.358], [89.3, 22.34]] },
  { title: "Tanguar Haor Wetland Margin, Sunamganj", type: "WETLAND", qty: 45, unit: "hectares", ring: [[91.04, 25.14], [91.062, 25.14], [91.062, 25.158], [91.04, 25.158], [91.04, 25.14]] },
  { title: "Buriganga Riverbank Cleanup, Dhaka", type: "RIVER_CLEANUP", qty: 3.2, unit: "km", ring: [[90.398, 23.7], [90.412, 23.704], [90.412, 23.709], [90.398, 23.705], [90.398, 23.7]] },
  { title: "Sonadia Coastal Belt, Cox's Bazar", type: "COASTAL_BELT", qty: 8000, unit: "saplings", ring: [[91.87, 21.465], [91.892, 21.462], [91.896, 21.482], [91.874, 21.485], [91.87, 21.465]] },
] as const;

const REASONS = [
  "Before and after frames show the same site; the planting rows are visible.",
  "Location inside the boundary and the capture time is plausible for this round.",
  "Image pair is consistent with the claimed activity and quantity.",
  "Cannot confirm the site from the frames provided; more proof requested.",
  "The after frame does not show any visible change from the before frame.",
  "Evidence is consistent; no conflicting findings were raised on review.",
];

// ---- run ---------------------------------------------------------------------------------
// (a function, not top-level await: tsx runs this file as CommonJS)
async function main() {
  const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 120, onnotice: () => {} });
  const t0 = Date.now();
  const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, (i + 1) * n));

  try {
    const [{ n }] = (await sql`select count(*)::int as n from organization where slug = 'sundarbans-restoration-trust'`) as unknown as [{ n: number }];
    if (n > 0) {
      console.log("already seeded; nothing to do (recreate the branch to reseed)");
      process.exit(0);
    }

    const pool = await makePool();
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const now = Date.now();

    await sql.begin(async (tx) => {
      // organisations
      const org = { owner: randomUUID(), verifier: randomUUID(), funder: randomUUID() };
      await tx`insert into organization ${tx(
        [
          { id: org.owner, name: "Sundarbans Restoration Trust", slug: "sundarbans-restoration-trust", org_type: "OWNER", country: "BD", created_at: new Date(now) },
          { id: org.verifier, name: "Delta Independent Audit", slug: "delta-independent-audit", org_type: "VERIFIER", country: "BD", created_at: new Date(now) },
          { id: org.funder, name: "Coastal Resilience Fund", slug: "coastal-resilience-fund", org_type: "FUNDER", country: "BD", created_at: new Date(now) },
        ],
        "id", "name", "slug", "org_type", "country", "created_at",
      )}`;

      // users: real scrypt hashes through Better Auth's own function, so sign-in works
      const people = [
        { key: "admin", name: "Rafiq Hossain", email: "admin@delta-demo.example", org: org.owner, role: "owner" },
        { key: "submitter", name: "Field Submitter", email: "submitter@delta-demo.example", org: org.owner, role: "member" },
        { key: "v1", name: "Verifier One", email: "verifier1@delta-demo.example", org: org.verifier, role: "member" },
        { key: "v2", name: "Verifier Two", email: "verifier2@delta-demo.example", org: org.verifier, role: "member" },
        { key: "vAdmin", name: "Audit Admin", email: "audit-admin@delta-demo.example", org: org.verifier, role: "admin" },
        { key: "funder", name: "Funder", email: "funder@delta-demo.example", org: org.funder, role: "member" },
      ].map((p) => ({ ...p, id: randomUUID() }));
      const uid = Object.fromEntries(people.map((p) => [p.key, p.id])) as Record<string, string>;

      await tx`insert into "user" ${tx(people.map((p) => ({ id: p.id, name: p.name, email: p.email, email_verified: true })), "id", "name", "email", "email_verified")}`;
      await tx`insert into account ${tx(people.map((p) => ({ id: randomUUID(), account_id: p.id, provider_id: "credential", user_id: p.id, password: passwordHash, updated_at: new Date(now) })), "id", "account_id", "provider_id", "user_id", "password", "updated_at")}`;
      await tx`insert into member ${tx(people.map((p) => ({ id: randomUUID(), organization_id: p.org, user_id: p.id, role: p.role, created_at: new Date(now) })), "id", "organization_id", "user_id", "role", "created_at")}`;

      // projects: exact boundary and salt only in project_private_location
      const projects: { id: string }[] = [];
      for (const p of PROJECTS) {
        const id = randomUUID();
        const boundary = { type: "Polygon", coordinates: [p.ring.map((c) => [...c])] };
        const saltHex = randomBytes(32).toString("hex");
        const [lon, lat] = fuzzCentroid(polygonCentroid(p.ring.map((c) => [c[0], c[1]] as LonLat)));
        await tx`insert into impact_project (id, owner_org_id, title, activity_type, claimed_quantity, claimed_unit, fuzzed_centroid, location_commitment, status)
          values (${id}, ${org.owner}, ${p.title}, ${p.type}, ${p.qty}, ${p.unit},
                  ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography,
                  ${await locationCommitment(saltHex, boundary)}, 'ACTIVE')`;
        await tx`insert into project_private_location (project_id, boundary, location_salt)
          values (${id}, ST_GeomFromGeoJSON(${JSON.stringify(boundary)}::text)::geography, ${Buffer.from(saltHex, "hex")})`;
        const [{ valid }] = (await tx`select ST_IsValid(boundary::geometry) as valid from project_private_location where project_id = ${id}`) as unknown as [{ valid: boolean }];
        if (!valid) throw new Error(`seed polygon is invalid: ${p.title}`);
        projects.push({ id });
      }
      await tx`insert into project_assignment ${tx(projects.map((p) => ({ project_id: p.id, verifier_org_id: org.verifier, assigned_by_user_id: uid.admin })), "project_id", "verifier_org_id", "assigned_by_user_id")}`;
      await tx`insert into project_funder ${tx(projects.slice(0, 2).map((p) => ({ project_id: p.id, funder_org_id: org.funder, created_by_user_id: uid.admin })), "project_id", "funder_org_id", "created_by_user_id")}`;

      // historical submissions, their image pairs and their decisions
      const WEIGHTED = [["APPROVED", 72], ["REJECTED", 14], ["IN_REVIEW", 6], ["NEEDS_MORE_PROOF", 4], ["ESCALATED", 2], ["PENDING_FORENSICS", 2]] as const;
      const status = () => {
        let r = rng() * 100;
        for (const [s, w] of WEIGHTED) if ((r -= w) < 0) return s;
        return "APPROVED";
      };
      const submissions: Row[] = [], files: Row[] = [], decisions: Row[] = [];
      for (let i = 0; i < SUBMISSIONS; i++) {
        const id = randomUUID();
        const st = status();
        const at = new Date(now - rng() * 540 * 86_400_000);
        submissions.push({ id, project_id: projects[i % projects.length]!.id, submitted_by_user_id: uid.submitter, owner_org_id: org.owner, status: st, round: 1, submitted_at: at });

        const before = pool[i % pool.length]!;
        const after = pool[(i + 3) % pool.length]!;
        for (const [role, img] of [["BEFORE", before], ["AFTER", after]] as const) {
          files.push({ id: randomUUID(), submission_id: id, role, storage_key: img.key, mime: "image/jpeg", size_bytes: img.bytes, sha256: img.sha256, client_sha256: img.sha256, dhash: img.dhash, round: 1, created_at: at });
        }

        const votes: [string, string][] =
          st === "APPROVED" ? [["v1", "APPROVE"], ["v2", "APPROVE"]]
          : st === "REJECTED" ? [["v1", "REJECT"], ["v2", "REJECT"]]
          : st === "ESCALATED" ? [["v1", "APPROVE"], ["v2", "REJECT"]]
          : st === "NEEDS_MORE_PROOF" ? [["v1", "REQUEST_MORE_PROOF"]]
          : st === "IN_REVIEW" && rng() < 0.5 ? [["v1", "APPROVE"]]
          : [];
        votes.forEach(([who, decision], k) =>
          decisions.push({ submission_id: id, round: 1, reviewer_user_id: uid[who], reviewer_org_id: org.verifier, decision, reason: pick(REASONS), created_at: new Date(at.getTime() + (k + 1) * 3_600_000) }),
        );
      }

      for (const c of chunks(submissions, 1000)) await tx`insert into evidence_submission ${tx(c, "id", "project_id", "submitted_by_user_id", "owner_org_id", "status", "round", "submitted_at")}`;
      for (const c of chunks(files, 500)) await tx`insert into evidence_file ${tx(c, "id", "submission_id", "role", "storage_key", "mime", "size_bytes", "sha256", "client_sha256", "dhash", "round", "created_at")}`;
      for (const c of chunks(decisions, 500)) await tx`insert into review_decision ${tx(c, "submission_id", "round", "reviewer_user_id", "reviewer_org_id", "decision", "reason", "created_at")}`;

      console.log(`organisations 3 | users ${people.length} | projects ${projects.length} | submissions ${submissions.length} | evidence files ${files.length} | decisions ${decisions.length}`);
    });

    console.log(`seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`\nDemo sign-ins (password "${DEMO_PASSWORD}"):`);
    for (const e of ["admin", "submitter", "verifier1", "verifier2", "audit-admin", "funder"]) console.log(`  ${e}@delta-demo.example`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
