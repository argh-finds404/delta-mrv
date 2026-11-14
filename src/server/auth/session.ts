import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NEXT_HEADER, safeNext, signInRedirect } from "../../lib/safe-next";
import { auth } from "./index";

// Authentication only: "who is this". It says nothing about what they may touch.
// session.activeOrganizationId is UI context, never an authorisation claim; every
// service re-checks membership against the database (docs/04-AUTH.md §3).

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * For pages and server actions. Redirects to /sign-in, remembering the page asked for when the
 * proxy passed it on: a cookie that exists but has expired gets past the proxy and lands here.
 * Services must not call this.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const next = safeNext((await headers()).get(NEXT_HEADER));
    redirect(next ? signInRedirect(next) : "/sign-in");
  }
  return session;
}
