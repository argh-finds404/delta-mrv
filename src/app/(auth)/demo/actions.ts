"use server";

import { headers } from "next/headers";
import { auth } from "../../../server/auth";
import { env } from "../../../env";
import { DEMO_PASSWORD, DEMO_PERSONA_EMAILS } from "../../../lib/demo-accounts";

/**
 * Starts a real session as a seeded demo user (docs/04-AUTH.md §8). Takes a persona id, never
 * an email, so it cannot sign in as anyone else; refuses unless DEMO_MODE is on.
 */
export async function signInAsDemo(personaId: string): Promise<{ success: boolean; error?: string }> {
  if (!env.DEMO_MODE) return { success: false, error: "Demo mode is not enabled." };
  const email = DEMO_PERSONA_EMAILS[personaId];
  if (!email) return { success: false, error: "Unknown demo persona." };

  try {
    // nextCookies() (last plugin) writes the session cookie from inside a server action
    await auth.api.signInEmail({ body: { email, password: DEMO_PASSWORD }, headers: await headers() });
    return { success: true };
  } catch {
    return { success: false, error: "The demo accounts are not seeded in this database. Run pnpm db:seed." };
  }
}
