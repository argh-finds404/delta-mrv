import { getSession } from "../../../../../server/auth/session";
import { listFindings } from "../../../../../server/services/submissions.service";
import { errorResponse, NO_STORE } from "../../../_lib/http";

// A submission's findings with its cached score beside them; hidden or missing is one 404.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  try {
    const result = await listFindings(session ? { userId: session.user.id } : null, (await params).id);
    return Response.json(result, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
