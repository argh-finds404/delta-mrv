import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { signInRedirect } from "./lib/safe-next";

// Next 16 proxy (never middleware.ts). An optimistic redirect for anonymous users:
// it only checks that a session cookie exists, not that it is valid, and it is not
// security. Authorisation happens in the services on every call (docs/04-AUTH.md §6).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    // next= brings them back to where they were going once they have signed in
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(new URL(signInRedirect(pathname, search), request.url));
  }
  return NextResponse.next();
}

// The (workspace) routes of docs/05-ROUTES.md §3. /projects/[id] itself is public.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/new",
    "/projects/:id/manage",
    "/projects/:id/submit",
    "/submissions/:path*",
    "/lab/:path*",
    "/admin/:path*",
  ],
};
