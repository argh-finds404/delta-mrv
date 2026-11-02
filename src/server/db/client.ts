import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../../env";
import * as schema from "./schema";

// postgres.js passes unknown URL params to the server as settings, and a Neon
// URL may carry channel_binding=require, which the server rejects as one.
const url = env.DATABASE_URL.replace(/([?&])channel_binding=[^&]*&?/, "$1").replace(/[?&]$/, "");

// Pooled URL over TCP. prepare: false because the pooler is pgbouncer in
// transaction mode. Not the Neon HTTP driver: it cannot run a transaction.
export const queryClient = postgres(url, { prepare: false, max: 5 });
export const db = drizzle(queryClient, { schema });
