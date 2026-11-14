"use server";

import { requireSession } from "../../../../../server/auth/session";
import { DomainError } from "../../../../../server/services/errors";
import { requestReviewer, updateProject, type UpdateProjectInput } from "../../../../../server/services/projects.service";

/** Saves a change to a project. Who may, and what may still change, is the service's rule; a refusal comes back as its message. */
export async function updateProjectAction(id: string, patch: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  try {
    await updateProject({ userId: session.user.id }, id, patch as UpdateProjectInput);
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Asks for an independent reviewer. It assigns nothing; an operator chooses. */
export async function requestReviewerAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  try {
    await requestReviewer({ userId: session.user.id }, id);
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}
