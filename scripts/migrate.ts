import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(connectionString);
const db = drizzle(sql);

async function main() {
  console.log("Applying migrations from ./drizzle...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully!");

  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log("Current public tables:", tables.map((t) => t.table_name));
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

