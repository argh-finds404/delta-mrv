import { NextResponse } from "next/server";
import { getSession } from "../../../../server/auth/session";
import { castDecision } from "../../../../server/services/reviews.service";
import { errorResponse, NO_STORE } from "../../_lib/http";

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
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
