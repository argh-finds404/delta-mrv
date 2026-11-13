// Latency of the two queries the forensics pipeline leans on (docs/11-IMPLEMENTATION.md Stage 8,
// S9), over the seeded history: the near-duplicate search (Hamming distance on bit(64)) and the
// geofence check (PostGIS on geography). The SQL is the services' own, copied from
// forensics.service.ts (perceptualMatches) and projects.service.ts (locateAgainstBoundary).
//
//   docker compose up -d && pnpm bench:queries
//
// shortcut: times the queries directly instead of through k6, because neither has an HTTP
// endpoint to aim k6 at; move to k6 if a load test of the whole request path is wanted.
import postgres from "postgres";

// Local Docker only, and hard-coded so it cannot be pointed at a hosted free tier (docs/01 S9).
const DB = "postgresql://delta:delta_local@localhost:5432/delta";
const RUNS = 400;
const CLIENTS = 8;

type Probe = { id: string; dhash: string; sha256: string; submission_id: string; round: number; project_id: string; owner_org_id: string };
type Site = { project_id: string; lon: number; lat: number };

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;

async function time(clients: number, one: (sql: postgres.Sql, i: number) => Promise<unknown>) {
  const sql = postgres(DB, { max: clients, onnotice: () => {} });
  try {
    await Promise.all(Array.from({ length: clients }, (_, i) => one(sql, i))); // open and warm every connection
    const ms: number[] = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: clients }, async () => {
        while (next < RUNS) {
          const i = next++;
          const t = performance.now();
          await one(sql, i);
          ms.push(performance.now() - t);
        }
      }),
    );
    ms.sort((a, b) => a - b);
    return `${pct(ms, 50).toFixed(1)} | ${pct(ms, 95).toFixed(1)} | ${ms.at(-1)!.toFixed(1)}`;
  } finally {
    await sql.end();
  }
}

async function main() {
  const setup = postgres(DB, { max: 1, onnotice: () => {} });
  const [{ files }] = await setup<{ files: number }[]>`select count(*)::int as files from evidence_file where dhash is not null`;
  const probes = await setup<Probe[]>`
    select f.id, f.dhash::text as dhash, f.sha256, f.submission_id, f.round, s.project_id, s.owner_org_id
    from evidence_file f join evidence_submission s on s.id = f.submission_id
    where f.dhash is not null order by md5(f.id::text) limit 200`;
  const sites = await setup<Site[]>`
    select project_id, ST_X(ST_Centroid(boundary::geometry)) as lon, ST_Y(ST_Centroid(boundary::geometry)) as lat from project_private_location`;
  await setup.end();
  if (!probes.length || !sites.length) throw new Error("the database is empty: run pnpm db:migrate and pnpm db:seed against local Docker first");

  const hamming = (sql: postgres.Sql, i: number) => {
    const f = probes[i % probes.length]!;
    return sql`
      select distinct on (scope) scope, id, distance from (
        select f.id, f.created_at,
          case when s.project_id = ${f.project_id} then 'SAME_PROJECT' when s.owner_org_id = ${f.owner_org_id} then 'SAME_ORG' else 'OTHER_ORG' end as scope,
          (f.dhash <~> ${f.dhash}::bit(64))::int as distance
        from evidence_file f join evidence_submission s on s.id = f.submission_id
        where f.dhash is not null and f.sha256 <> ${f.sha256}
          and (f.created_at, f.id) < (select created_at, id from evidence_file where id = ${f.id})
          and not (f.submission_id = ${f.submission_id} and f.round = ${f.round})
          and (f.dhash <~> ${f.dhash}::bit(64)) < 8
      ) m order by scope, distance, created_at, id`;
  };
  const spatial = (sql: postgres.Sql, i: number) => {
    const s = sites[i % sites.length]!;
    // a point up to about 3 km from the centre: some inside the boundary, some in tolerance, some out
    const [lon, lat] = [s.lon + (((i * 37) % 61) - 30) / 1000, s.lat + (((i * 53) % 61) - 30) / 1000];
    return sql`
      select ST_Covers(l.boundary, ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography) as inside,
             ST_DWithin(l.boundary, ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography, p.tolerance_meters) as within,
             ST_Distance(l.boundary, ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography) as distance
      from project_private_location l join impact_project p on p.id = l.project_id
      where l.project_id = ${s.project_id}`;
  };

  console.log(`${files} fingerprinted files, ${sites.length} project boundaries, ${RUNS} runs each, milliseconds\n`);
  console.log("| Query | Clients | p50 | p95 | max |\n|---|---|---|---|---|");
  for (const [name, one] of [["Near-duplicate search (Hamming < 8)", hamming], ["Geofence check (ST_Covers, ST_DWithin, ST_Distance)", spatial]] as const)
    for (const clients of [1, CLIENTS]) console.log(`| ${name} | ${clients} | ${await time(clients, one)} |`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
