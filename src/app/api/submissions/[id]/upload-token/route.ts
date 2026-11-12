import { issueUploadToken } from "../../../../../server/services/submissions.service";
import { authedJson } from "../../../_lib/http";

// A token for one direct-to-storage upload, at a path the server chose. The browser then calls
// `put(pathname, file, { access: "private", token: clientToken })` from @vercel/blob/client.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authedJson(request, (actor, body) =>
    issueUploadToken(actor, id, { role: body.role as "BEFORE" | "AFTER" | "SUPPLEMENT", contentType: String(body.contentType ?? "") }),
  );
}
