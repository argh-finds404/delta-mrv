import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/server/db/schema";

const url = process.env.DATABASE_URL_UNPOOLED; // env and the production guard: setup.ts
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");

export const client = postgres(url, { max: 1, prepare: false, connect_timeout: 120 });
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
