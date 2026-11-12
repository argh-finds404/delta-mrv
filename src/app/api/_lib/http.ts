import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "../../../server/auth/session";
import { ConflictError, ConflictOfInterestError, DomainError, ForbiddenError, NotFoundError, StorageUnavailable, ValidationError } from "../../../server/services/errors";
import type { Actor } from "../../../server/services/access";

// Shared by the mutating API routes: authenticate, read the JSON body, map domain errors to
// HTTP. Every rule lives in the services; a route only translates. (`_lib` is not a route.)

export const NO_STORE = { "Cache-Control": "no-store" };

export function errorResponse(e: unknown): NextResponse {
  const json = (status: number) => NextResponse.json({ error: (e as Error).message }, { status, headers: NO_STORE });
  if (e instanceof ValidationError) return json(422);
  if (e instanceof NotFoundError) return json(404);
  if (e instanceof ConflictOfInterestError || e instanceof ForbiddenError) return json(403);
  if (e instanceof ConflictError) return json(409);
  if (e instanceof DomainError) return json(400);
  if (e instanceof StorageUnavailable) return NextResponse.json({ error: "Evidence storage is not configured on this server." }, { status: 503, headers: NO_STORE });
  throw e;
}

/** Runs `fn` for a signed-in caller with the parsed body; 401 without a session, 422 without JSON. */
export async function authedJson<T>(request: Request, fn: (actor: Actor, body: Record<string, unknown>) => Promise<T>, status = 200) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "a JSON object body is required" }, { status: 422, headers: NO_STORE });
  }
  try {
    return NextResponse.json(await fn({ userId: session.user.id }, body as Record<string, unknown>), { status, headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
