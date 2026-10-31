import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  console.log("Enabling PostGIS...");
  await sql`CREATE EXTENSION IF NOT EXISTS postgis;`;
  console.log("PostGIS enabled successfully.");

  console.log("Enabling pgvector...");
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  console.log("pgvector enabled successfully.");

  const extensions = await sql`
    SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'vector', 'neon');
  `;
  console.log("Active extensions:", extensions);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});

