import { createCheckupDraft, createDraft } from "../../../server/services/submissions.service";
import { authedJson } from "../_lib/http";

// Starts a DRAFT submission for a project of the caller's organisation (Stage 4b): a before/after
// pair with { projectId }, or a survival check-up of an approved record with { checkupOf }.
export async function POST(request: Request) {
  return authedJson(request, (actor, body) => (typeof body.checkupOf === "string" ? createCheckupDraft(actor, body.checkupOf) : createDraft(actor, String(body.projectId ?? ""))), 201);
}
