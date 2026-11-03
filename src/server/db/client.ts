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
//
// connect_timeout (seconds) is 60. postgres.js defaults to 30, and the CONNECT_TIMEOUT
// failures on the developer link to Neon us-east-2 fired at exactly 30: a cold connection
// (compute waking, TLS) can outlast it. Node's own per-address attempt timeout is a
// separate limit, see docs/DEPENDENCY_LOG.md.
// idle_timeout (seconds): serverless instances come and go, so an idle connection is
// closed after 20 s instead of being held open against the pooler's limit.
export const queryClient = postgres(url, {
  prepare: false,
  max: 5,
  connect_timeout: 60,
  idle_timeout: 20,
});
export const db = drizzle(queryClient, { schema });
