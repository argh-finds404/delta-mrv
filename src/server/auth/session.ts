import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";

// Authentication only: "who is this". It says nothing about what they may touch.
// session.activeOrganizationId is UI context, never an authorisation claim; every
// service re-checks membership against the database (docs/04-AUTH.md §3).

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** For pages and server actions. Redirects to /sign-in; services must not call this. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}
