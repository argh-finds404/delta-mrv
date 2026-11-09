// Gives the seeded evidence_file rows real bytes (docs/AGENT_PROMPTS.md Stage 3a). The seed
// cannot be re-run (append-only tables), so the pool is regenerated with the seed's own
// generator, and every image must hash to what the database already holds. A mismatch means
// the pool is not reproducible: nothing is uploaded, and the script stops.
//
//   pnpm seed:images
//
// Idempotent: an image already in the store is not uploaded again, only re-read and re-hashed.
// The one script allowed to import @vercel/blob: scripts cannot import src/server.
import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";
import postgres from "postgres";
import { makePool } from "./lib/seed-pool";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: the environment must already be set
}
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");
const dbUrl: string = url;
if (!process.env.NEON_BRANCH || process.env.NEON_BRANCH === "production") {
  throw new Error(`refusing to run: NEON_BRANCH is "${process.env.NEON_BRANCH ?? ""}"`);
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// (a function, not top-level await: tsx runs this file as CommonJS)
async function main() {
  const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 120, onnotice: () => {} });
  try {
    const pool = await makePool();
    const rows = await sql<{ key: string; hashes: string[] }[]>`
      select storage_key as key, array_agg(distinct sha256) as hashes
      from evidence_file where storage_key in ${sql(pool.map((p) => p.key))} group by storage_key`;
    if (!rows.length) throw new Error("no seeded evidence_file rows found: run pnpm db:seed on this branch first");

    // 1. Every regenerated image must match the database before anything is uploaded.
    for (const img of pool) {
      const hashes = rows.find((r) => r.key === img.key)?.hashes ?? [];
      if (hashes.length !== 1 || hashes[0] !== img.sha256) {
        throw new Error(`${img.key} is not reproducible: database has [${hashes.join(", ")}], regenerated ${img.sha256}. Stop and report.`);
      }
    }
    console.log(`all ${pool.length} pool images reproduce the seeded sha256`);

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set: the hashes match, only the upload is left");

    // 2. Upload what is missing, then hash what the store actually holds (the authority rule).
    for (const img of pool) {
      const opts = { access: "private" as const, token, useCache: false };
      let stored = await get(img.key, opts);
      if (!stored) {
        await put(img.key, img.jpeg, { access: "private", token, contentType: "image/jpeg", addRandomSuffix: false });
        stored = await get(img.key, opts);
      }
      if (stored?.statusCode !== 200) throw new Error(`${img.key} could not be read back from the store`);
      const back = sha256(new Uint8Array(await new Response(stored.stream).arrayBuffer()));
      if (back !== img.sha256) throw new Error(`${img.key} in the store hashes to ${back}, expected ${img.sha256}`);
      console.log(`${img.key}  ${back}  ok`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
