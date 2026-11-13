"use server";

import { requireSession } from "../../../../server/auth/session";
import { DomainError } from "../../../../server/services/errors";
import { createProject, updateProject, type CreateProjectInput } from "../../../../server/services/projects.service";

/**
 * Registers a project and opens it for evidence. Every rule (who may create, what a valid
 * boundary is) lives in the service; an invalid input comes back as its message.
 */
export async function createProjectAction(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const actor = { userId: session.user.id };
  try {
    const project = await createProject(actor, input as CreateProjectInput);
    await updateProject(actor, project.id, { status: "ACTIVE" });
    return { ok: true, id: project.id };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e;
  }
}
