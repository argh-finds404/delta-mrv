import { NextResponse } from "next/server";
import { MAX_EVIDENCE_BYTES } from "../../../../lib/forensics/mime";
import { acceptLocalUpload } from "../../../../server/services/submissions.service";

// Development only: where a browser sends an evidence file when this server keeps evidence on
// its own disk (LOCAL_STORAGE_DIR) instead of the blob store. It does not exist otherwise: a
// production build, or a server without that setting, answers 404. The token in the
// Authorization header was issued by POST /api/submissions/[id]/upload-token for exactly one path.
export async function PUT(request: Request) {
  const pathname = request.headers.get("x-pathname") ?? "";
  const token = request.headers.get("authorization") ?? "";
  if (Number(request.headers.get("content-length") ?? 0) > MAX_EVIDENCE_BYTES) return NextResponse.json({ error: "a photo is larger than 5 MB" }, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const stored = await acceptLocalUpload(token, pathname, request.headers.get("content-type") ?? "", bytes);
  if (stored === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!stored) return NextResponse.json({ error: "this upload was not accepted" }, { status: 403 });
  return NextResponse.json({ pathname }, { status: 201 });
}
