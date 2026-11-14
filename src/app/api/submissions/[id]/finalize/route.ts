import "../../../../../server/services/job-handlers";
import { drainAfterResponse } from "../../../../../server/services/jobs.service";
import { finalizeSubmission } from "../../../../../server/services/submissions.service";
import { authedJson } from "../../../_lib/http";

// DRAFT → PENDING_FORENSICS from the stored bytes; forensics starts after the response is sent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authedJson(request, async (actor, body) => {
    const summary = await finalizeSubmission(actor, id, { files: body.files as { role: "BEFORE" | "AFTER"; pathname: string; clientSha256?: string }[], attestation: body.attestation });
    drainAfterResponse();
    return summary;
  });
}
