"use server";

import { requireSession } from "../../../../../server/auth/session";
import { DomainError } from "../../../../../server/services/errors";
import { requestReviewer, setCheckupSchedule, updateProject, type UpdateProjectInput } from "../../../../../server/services/projects.service";

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

/** Sets the survival check-up interval. The service refuses lengthening or removing it once a record is approved. */
export async function setCheckupScheduleAction(id: string, months: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  try {
    await setCheckupSchedule({ userId: session.user.id }, id, months);
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
