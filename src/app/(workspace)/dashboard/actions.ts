"use server";

import { requireSession } from "../../../server/auth/session";
import { createApiKey, revokeApiKey } from "../../../server/services/api-key.service";
import { DomainError } from "../../../server/services/errors";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** A new read-only key for one of the caller's organisations. The key is returned once and never stored. */
export async function createApiKeyAction(orgId: string): Promise<Result<{ key: string }>> {
  const session = await requireSession();
  try {
    const { key } = await createApiKey({ userId: session.user.id }, orgId);
    return { ok: true, key };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function revokeApiKeyAction(id: string): Promise<Result<object>> {
  const session = await requireSession();
  try {
    await revokeApiKey({ userId: session.user.id }, id);
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}
