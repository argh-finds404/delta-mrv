import { defineConfig } from "drizzle-kit";

// Migrations use the direct URL. It is read from the process environment only
// (no .env.local), so `db:migrate` fails loudly instead of reaching a database
// nobody chose. Local Docker only until the maintainer says otherwise.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
});
