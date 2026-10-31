import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

// Per neon-postgres skill: use pooled DATABASE_URL with @neondatabase/serverless for web/serverless query traffic
const sqlClient = neon(databaseUrl);

export const db = drizzle(sqlClient, { schema });

export const neonEnv = {
  get branch(): string {
    return process.env.NEON_BRANCH ?? "production";
  },
  get isConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  },
  get hasPooledUrl(): boolean {
    return Boolean(process.env.DATABASE_URL?.includes("-pooler"));
  },
  get hasDirectUrl(): boolean {
    return Boolean(process.env.DATABASE_URL_UNPOOLED);
  },
};
