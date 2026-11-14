import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { apiKey } from "../db/schema";
import { actorContext, isUuid, type Actor, type Executor } from "./access";
import { NotFoundError, ValidationError } from "./errors";

// API keys for the read-only public API (docs/04-AUTH.md §7): `dmrv_<prefix>_<secret>`. Only
// the prefix and a SHA-256 of the whole key are stored; the key itself is shown once, at
// creation. A key belongs to one organisation, carries a scope list, can never write, and is
// revoked by a timestamp, never deleted.

export const API_SCOPES = ["stats:read"] as const;

const KEY = /^dmrv_([0-9a-f]{12})_([A-Za-z0-9_-]{43})$/;
const hashOf = (key: string) => createHash("sha256").update(key).digest("hex");

export type ApiKeyView = { id: string; keyPrefix: string; scopes: string[]; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null };
const view = { id: apiKey.id, keyPrefix: apiKey.keyPrefix, scopes: apiKey.scopes, createdAt: apiKey.createdAt, lastUsedAt: apiKey.lastUsedAt, revokedAt: apiKey.revokedAt };

/** The caller must belong to the organisation; anyone else is told it does not exist. */
async function assertMember(x: Executor, actor: Actor, orgId: string): Promise<void> {
  const ctx = await actorContext(x, actor);
  if (!isUuid(orgId) || !ctx.orgIds.includes(orgId)) throw new NotFoundError("organisation not found");
}

/** A new key for one of the caller's organisations. `key` is returned here and nowhere else, ever. */
export async function createApiKey(actor: Actor, orgId: string, scopes: readonly string[] = API_SCOPES, x: Executor = db): Promise<ApiKeyView & { key: string }> {
  await assertMember(x, actor, orgId);
  const unknown = scopes.filter((s) => !(API_SCOPES as readonly string[]).includes(s));
  if (!scopes.length || unknown.length) throw new ValidationError(`a key needs at least one of these scopes: ${API_SCOPES.join(", ")}`);
  const keyPrefix = randomBytes(6).toString("hex");
  const key = `dmrv_${keyPrefix}_${randomBytes(32).toString("base64url")}`;
  const [row] = await x.insert(apiKey).values({ keyPrefix, keyHash: hashOf(key), orgId, scopes: [...scopes] }).returning(view);
  return { ...row!, key };
}

/** Every key of the caller's organisations, newest first. Never the key or its hash. */
export async function listApiKeys(actor: Actor, x: Executor = db): Promise<(ApiKeyView & { orgId: string })[]> {
  const ctx = await actorContext(x, actor);
  if (!ctx.orgIds.length) return [];
  return x.select({ ...view, orgId: apiKey.orgId }).from(apiKey).where(inArray(apiKey.orgId, ctx.orgIds)).orderBy(desc(apiKey.createdAt));
}

/** Revokes a key of the caller's organisation: it stops working at once and stays on record. */
export async function revokeApiKey(actor: Actor, id: string, x: Executor = db): Promise<void> {
  const ctx = await actorContext(x, actor);
  const notFound = new NotFoundError("key not found");
  if (!isUuid(id) || !ctx.orgIds.length) throw notFound;
  const [row] = await x
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKey.id, id), inArray(apiKey.orgId, ctx.orgIds), isNull(apiKey.revokedAt)))
    .returning({ id: apiKey.id });
  if (!row) {
    const [exists] = await x.select({ id: apiKey.id }).from(apiKey).where(and(eq(apiKey.id, id), inArray(apiKey.orgId, ctx.orgIds)));
    if (!exists) throw notFound; // already revoked is not an error
  }
}

/**
 * Who a bearer token is: the organisation and scopes of a live key, or null. Looked up by
 * prefix, then compared hash to hash in constant time, so a wrong key and an unknown key look
 * the same to the caller.
 */
export async function authenticateApiKey(authorization: string | null, x: Executor = db): Promise<{ keyId: string; orgId: string; scopes: string[] } | null> {
  const key = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const match = KEY.exec(key);
  if (!match) return null;
  const given = Buffer.from(hashOf(key), "hex");
  const rows = await x
    .select({ id: apiKey.id, orgId: apiKey.orgId, scopes: apiKey.scopes, keyHash: apiKey.keyHash })
    .from(apiKey)
    .where(and(eq(apiKey.keyPrefix, match[1]!), isNull(apiKey.revokedAt)));
  const found = rows.find((r) => timingSafeEqual(Buffer.from(r.keyHash, "hex"), given));
  if (!found) return null;
  await x.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, found.id));
  return { keyId: found.id, orgId: found.orgId, scopes: found.scopes };
}
