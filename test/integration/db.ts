import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/server/db/schema";

// Explicit environment wins; .env.local only fills in what is missing.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local (CI, local Docker): the environment must already be set
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");
// Integration tests write (inside rolled-back transactions) and must never reach production.
if (!process.env.NEON_BRANCH || process.env.NEON_BRANCH === "production") {
  throw new Error(`refusing to run integration tests: NEON_BRANCH is "${process.env.NEON_BRANCH ?? ""}"`);
}

export const client = postgres(url, { max: 1, prepare: false });
export const db = drizzle(client, { schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

class Rollback extends Error {}

/** Runs fn in a transaction and always rolls back. Append-only tables cannot be truncated. */
export async function inRollback(fn: (tx: Tx) => Promise<void>) {
  await db
    .transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

/** Drizzle wraps driver errors; the Postgres message is on `cause`. */
export async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return err.cause?.message ?? err.message;
  }
  throw new Error("expected the statement to raise, but it succeeded");
}

let n = 0;
/** One OWNER org plus one user, enough to satisfy every FK in the spike. */
export async function seedOrgAndUser(tx: Tx) {
  const tag = `${Date.now()}-${n++}`;
  const [org] = await tx
    .insert(schema.organization)
    .values({ name: `Spike Org ${tag}`, slug: `spike-${tag}`, orgType: "OWNER", createdAt: new Date() })
    .returning();
  const [usr] = await tx
    .insert(schema.user)
    .values({ name: "Spike User", email: `spike-${tag}@example.test` })
    .returning();
  return { org: org!, usr: usr! };
}
