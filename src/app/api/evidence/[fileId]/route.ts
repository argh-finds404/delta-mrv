import { getSession } from "../../../../server/auth/session";
import { NotFoundError, StorageUnavailable } from "../../../../server/services/errors";
import { openEvidenceFile } from "../../../../server/services/submissions.service";

const PRIVATE = { "Cache-Control": "private, no-store" };

// Streams an original through the server: the private store has no URL to hand out, and a
// signed one would outlive this visibility check. Anonymous, hidden and missing: one 404.
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await getSession();
  try {
    const file = await openEvidenceFile(session ? { userId: session.user.id } : null, (await params).fileId);
    return new Response(file.stream, {
      headers: {
        ...PRIVATE,
        "Content-Type": file.mime,
        "Content-Length": String(file.size),
        "X-Content-Type-Options": "nosniff",
        // uploaded bytes served from our origin must never run as a document
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: e.message }, { status: 404, headers: PRIVATE });
    if (e instanceof StorageUnavailable) return Response.json({ error: "Evidence storage is not configured on this server." }, { status: 503, headers: PRIVATE });
    throw e;
  }
}
