import { createDraft } from "../../../server/services/submissions.service";
import { authedJson } from "../_lib/http";

// Starts a DRAFT submission for a project of the caller's organisation (Stage 4b).
export async function POST(request: Request) {
  return authedJson(request, (actor, body) => createDraft(actor, String(body.projectId ?? "")), 201);
}
