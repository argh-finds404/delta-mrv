import { sql } from "drizzle-orm";
import { db, neonEnv } from "@/src/server/db";

export interface NeonTelemetry {
  connected: boolean;
  database: string;
  user: string;
  pgVersion: string;
  serverTime: string;
  branch: string;
  pooledConnection: boolean;
  directUrlConfigured: boolean;
  latencyMs: number;
  availableExtensions: string[];
}

/**
 * Core service function verifying end-to-end connectivity with Lakebase Postgres on Neon.
 */
export async function getNeonTelemetry(): Promise<NeonTelemetry> {
  const start = performance.now();

  const metaResult = await db.execute<{
    db_name: string;
    db_user: string;
    pg_version: string;
    server_time: string;
  }>(sql`
    SELECT
      current_database() AS db_name,
      current_user AS db_user,
       split_part(version(), ',', 1) AS pg_version,
      now()::text AS server_time
  `);

  const extResult = await db.execute<{ name: string }>(sql`
    SELECT name
    FROM pg_available_extensions
    WHERE name IN ('vector', 'postgis', 'pg_stat_statements', 'neon')
    ORDER BY name ASC
  `);

  const latencyMs = Math.round((performance.now() - start) * 100) / 100;
  const row = metaResult.rows[0];

  return {
    connected: true,
    database: row?.db_name ?? "unknown",
    user: row?.db_user ?? "unknown",
    pgVersion: row?.pg_version ?? "unknown",
    serverTime: row?.server_time ?? new Date().toISOString(),
    branch: neonEnv.branch,
    pooledConnection: neonEnv.hasPooledUrl,
    directUrlConfigured: neonEnv.hasDirectUrl,
    latencyMs,
    availableExtensions: extResult.rows.map((r) => r.name),
  };
}

