"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export type ProjectPatch = { title?: string; description?: string; claimedQuantity?: number; claimedUnit?: string; toleranceMeters?: number; status?: "ACTIVE" | "CLOSED" };
type Save = (patch: ProjectPatch) => Promise<{ ok: true } | { ok: false; error: string }>;

const field =
  "h-11 w-full rounded-xl border border-field-hairline bg-white px-3 text-[15px] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 disabled:bg-field-raised disabled:text-field-muted";
const label = "block space-y-1.5 text-[14px] font-medium";
const quiet = "inline-flex h-11 items-center rounded-xl border border-field-hairline px-4 text-[15px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55";

/**
 * /projects/[id]/manage (docs/05-ROUTES.md §3): what an owner may still change. `locked` means
 * evidence has been sent, so the name, the claim and the tolerance are what reviewers judged and
 * stay as they are; the service refuses the change whatever this form shows.
 */
export function ManageProjectForm({
  project,
  locked,
  save,
}: {
  project: { title: string; description: string | null; claimedQuantity: string | null; claimedUnit: string | null; toleranceMeters: number; status: "DRAFT" | "ACTIVE" | "CLOSED" };
  locked: boolean;
  save: Save;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const closed = project.status === "CLOSED";

  const run = (patch: ProjectPatch, done: string) =>
    start(async () => {
      setMessage(null);
      const res = await save(patch).catch(() => ({ ok: false as const, error: "The change could not be sent. Nothing was saved." }));
      setMessage(res.ok ? { ok: true, text: done } : { ok: false, text: res.error });
      setConfirmClose(false);
      if (res.ok) router.refresh();
    });

  // onSubmit, not a form action: React empties the fields after an action
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const patch: ProjectPatch = { description: text("description") };
    if (!locked) {
      patch.title = text("title");
      patch.toleranceMeters = Number(text("toleranceMeters"));
      if (text("claimedQuantity")) patch.claimedQuantity = Number(text("claimedQuantity"));
      if (text("claimedUnit")) patch.claimedUnit = text("claimedUnit");
    }
    run(patch, "Saved.");
  };

  return (
    <div className="max-w-[640px] space-y-10">
      <form onSubmit={submit} className="space-y-5">
        {locked && (
          <p className="rounded-xl border border-field-hairline bg-field-raised px-4 py-3 text-[14px] leading-[1.6] text-field-muted">
            Evidence has been sent for this project, so its name, its claim and its tolerance are fixed: reviewers judge the evidence against them. The description can still change.
          </p>
        )}
        <label className={label}>
          Project name
          <input name="title" required minLength={1} maxLength={200} defaultValue={project.title} disabled={locked || closed} className={field} />
        </label>
        <label className={label}>
          Description <span className="font-normal text-field-muted">(shown on the public project page)</span>
          <textarea
            name="description"
            maxLength={5000}
            rows={5}
            defaultValue={project.description ?? ""}
            disabled={closed}
            className="w-full rounded-xl border border-field-hairline bg-white px-3 py-2.5 text-[15px] leading-[1.55] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 disabled:bg-field-raised disabled:text-field-muted"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            What you claim
            <input name="claimedQuantity" type="number" min="0" step="any" inputMode="decimal" defaultValue={project.claimedQuantity ?? ""} disabled={locked || closed} className={field} />
          </label>
          <label className={label}>
            Unit
            <input name="claimedUnit" maxLength={50} defaultValue={project.claimedUnit ?? ""} disabled={locked || closed} className={field} />
          </label>
        </div>
        <label className={label}>
          Tolerance around the boundary, in metres
          <input name="toleranceMeters" type="number" min="0" max="5000" step="1" inputMode="numeric" required defaultValue={project.toleranceMeters} disabled={locked || closed} className={field} />
          <span className="block font-normal text-field-muted">A photo taken this close to the boundary is recorded as within tolerance, not as outside.</span>
        </label>
        {!closed && (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        )}
        <p role="status" className={message?.ok === false ? "text-[14px] text-fraud" : "text-[14px] text-field-muted"}>
          {message?.text}
        </p>
      </form>

      <section aria-labelledby="state" className="space-y-3 border-t border-field-hairline pt-8">
        <h2 id="state" className="font-serif text-[24px] leading-tight">
          {closed ? "This project is closed" : project.status === "DRAFT" ? "Not open for evidence yet" : "Close the project"}
        </h2>
        {closed ? (
          <p className="text-[15px] leading-[1.6] text-field-muted">It takes no new evidence. Everything already recorded stays as it is, and approved records stay public.</p>
        ) : project.status === "DRAFT" ? (
          <>
            <p className="text-[15px] leading-[1.6] text-field-muted">A draft project is visible only to your organisation and takes no evidence.</p>
            <button type="button" disabled={pending} onClick={() => run({ status: "ACTIVE" }, "The project is open for evidence.")} className={quiet}>
              Open it for evidence
            </button>
          </>
        ) : confirmClose ? (
          <div className="space-y-3">
            <p className="text-[15px] leading-[1.6]">A closed project takes no new evidence and cannot be opened again. Everything already recorded stays as it is.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={pending} onClick={() => run({ status: "CLOSED" }, "The project is closed.")} className={`${quiet} border-fraud/50 text-fraud`}>
                {pending ? "Closing…" : "Close it for good"}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmClose(false)} className={quiet}>
                Keep it open
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[15px] leading-[1.6] text-field-muted">When the work is finished. A closed project takes no new evidence; what is recorded stays.</p>
            <button type="button" onClick={() => setConfirmClose(true)} className={quiet}>
              Close the project…
            </button>
          </>
        )}
      </section>
    </div>
  );
}
