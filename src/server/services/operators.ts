import "server-only";
import { eq } from "drizzle-orm";
import { env, operatorEmails } from "../../env";
import { DEMO_OPERATOR_EMAIL } from "../../lib/demo-accounts";
import { db } from "../db/client";
import { user } from "../db/schema";
import { emailConfigured } from "../email";
import type { Actor, Executor } from "./access";
import { ForbiddenError } from "./errors";

/**
 * Whether the caller is an operator (src/lib/operators.ts): their account's address is in
 * OPERATOR_EMAILS, or, on a demo deployment, it is the seeded demo admin. Read fresh on every
 * call, like a membership. Being an operator grants no vote: assertCanReview never asks.
 */
export async function isOperator(actor: Actor, x: Executor = db): Promise<boolean> {
  const [row] = await x.select({ email: user.email, verified: user.emailVerified }).from(user).where(eq(user.id, actor.userId));
  if (!row) return false;
  // where this server can send email, an address counts only once its owner has proved it:
  // otherwise whoever registers an operator's address first would hold the operator's powers
  if (emailConfigured() && !row.verified) return false;
  const email = row.email.toLowerCase();
  return operatorEmails().has(email) || (env.DEMO_MODE === "true" && email === DEMO_OPERATOR_EMAIL);
}

export async function assertOperator(x: Executor, actor: Actor): Promise<void> {
  if (!(await isOperator(actor, x))) throw new ForbiddenError("only a Delta operator may do this");
}
