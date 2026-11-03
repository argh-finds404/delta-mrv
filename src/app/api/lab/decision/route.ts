import { NextResponse } from "next/server";
import { getSession } from "../../../../server/auth/session";
import {
  ConflictError,
  ConflictOfInterestError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../../server/services/errors";
import { castDecision } from "../../../../server/services/reviews.service";

// One review decision. All rules (conflict of interest, assignment, round, quorum) live in
// castDecision; this only authenticates and maps its errors to HTTP.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { submissionId?: unknown; decision?: unknown; reason?: unknown } | null;
  if (!body || typeof body.submissionId !== "string") {
    return NextResponse.json({ error: "submissionId is required" }, { status: 422 });
  }

  try {
    const result = await castDecision(
      { userId: session.user.id },
      body.submissionId,
      { decision: body.decision as "APPROVE" | "REJECT" | "REQUEST_MORE_PROOF", reason: String(body.reason ?? "") },
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof ConflictOfInterestError || e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
