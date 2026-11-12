import "../../../../../server/services/job-handlers";
import { drainAfterResponse } from "../../../../../server/services/jobs.service";
import { addSupplement } from "../../../../../server/services/submissions.service";
import { authedJson } from "../../../_lib/http";

// NEEDS_MORE_PROOF → IN_REVIEW with one more photo, in a new round; forensics runs after the response.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authedJson(request, async (actor, body) => {
    const summary = await addSupplement(actor, id, {
      pathname: String(body.pathname ?? ""),
      clientSha256: typeof body.clientSha256 === "string" ? body.clientSha256 : undefined,
    });
    drainAfterResponse();
    return summary;
  });
}
