// Fails if a geography column has lost its typmod (docs/03-DATABASE.md §7.1).
// drizzle-kit emits bare `geography`; drizzle/0002_geography_typmod.sql applies
// geography(Point|Polygon, 4326). A later generated migration can silently revert it.
// Reads DATABASE_URL_UNPOOLED from the process environment only.
import postgres from "postgres";

const EXPECTED = {
  "impact_project.fuzzed_centroid": "Point",
  "project_private_location.boundary": "Polygon",
  "evidence_file.gps": "Point",
};

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("check-geography-typmod: DATABASE_URL_UNPOOLED is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  // information_schema.columns has no typmod; PostGIS's geography_columns does.
  const rows = await sql`
    select f_table_name || '.' || f_geography_column as col, type, srid
    from geography_columns
    where f_table_schema = 'public'`;
  const found = new Map(rows.map((r) => [r.col, r]));

  const problems = [];
  for (const [col, type] of Object.entries(EXPECTED)) {
    const row = found.get(col);
    if (!row) problems.push(`${col}: column not found`);
    else if (row.type !== type || row.srid !== 4326)
      problems.push(`${col}: expected geography(${type},4326), found ${row.type},${row.srid}`);
  }

  if (problems.length) {
    console.error("check-geography-typmod: FAILED\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log(`check-geography-typmod: ok (${Object.keys(EXPECTED).length} columns)`);
} finally {
  await sql.end();
}
