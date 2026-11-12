import { getSession } from "../../../../../server/auth/session";
import { getRoundDecisions } from "../../../../../server/services/reviews.service";
import { errorResponse, NO_STORE } from "../../../_lib/http";

// A submission's review decisions under A4: the open round's reasons only after the caller has voted.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  try {
    return Response.json(await getRoundDecisions({ userId: session.user.id }, (await params).id), { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
