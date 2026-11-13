"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { signInAsDemo } from "./actions";

export interface DemoPersona {
  id: string;
  role: string;
  organization: string;
  whatToTry: string;
  note?: string;
}

// Ids are the only thing sent to the server (actions.ts maps them to seeded accounts).
export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "persona-owner",
    role: "Field submitter",
    organization: "Sundarbans Restoration Trust",
    whatToTry: "Submit a before and after photo for a project site, then watch the automatic checks report back.",
  },
  {
    id: "persona-verifier-1",
    role: "Verifier one",
    organization: "Delta Independent Audit",
    whatToTry: "Work through the review queue, read each finding's reason, and approve or reject in writing.",
    note: "Approval needs two verifiers from this organisation.",
  },
  {
    id: "persona-verifier-2",
    role: "Verifier two",
    organization: "Delta Independent Audit",
    whatToTry: "Give the second independent decision. Two approvals make a submission APPROVED.",
  },
  {
    id: "persona-funder",
    role: "Funder",
    organization: "Coastal Resilience Fund",
    whatToTry: "See the projects you fund and the submissions that have been approved for them.",
  },
];

const PATH: { step: string; built: boolean }[] = [
  { step: "As the field submitter, submit a before and after pair.", built: true },
  { step: "The checks run: a reused photo is flagged HIGH, with its reason.", built: true },
  { step: "As verifier one, review the findings and approve in writing.", built: true },
  { step: "As verifier two, approve. The submission becomes APPROVED.", built: true },
  { step: "Approved records are anchored on chain and checked on a public proof page.", built: true },
];

/** One-click roles for the seeded demo database (docs/04-AUTH.md §8). Exists only with DEMO_MODE. */
export default function DemoPage() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const start = async (persona: DemoPersona) => {
    setPending(persona.id);
    setError(null);
    // A real session for a seeded user; the action checks DEMO_MODE itself.
    const res = await signInAsDemo(persona.id);
    if (!res.success) {
      setError(res.error ?? "Could not start the demo session.");
      setPending(null);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-[14px] text-field-muted">Demo database</p>
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Try Delta as one of four people</h1>
        <p className="text-[16px] leading-[1.55] text-field-muted">
          Each role signs you in to a real session on seeded data. The rule that nobody reviews their own organisation&apos;s work applies here too.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-fraud/40 bg-fraud/10 px-4 py-3 text-[15px]">
          {error}
        </p>
      )}

      <ul className="space-y-3" aria-label="Demo roles">
        {DEMO_PERSONAS.map((p) => {
          const busy = pending === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => start(p)}
                disabled={pending !== null}
                aria-busy={busy}
                className={cn(
                  "group w-full cursor-pointer rounded-xl border bg-field-canopy p-5 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-wait",
                  busy ? "border-signal" : "border-field-hairline hover:border-signal/70",
                )}
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="text-[18px] font-medium text-field-text">{p.role}</span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[14px] text-signal">
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {busy ? "Signing in…" : "Continue"}
                    {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
                  </span>
                </span>
                <span className="mt-0.5 block text-[14px] text-field-muted">{p.organization}</span>
                <span className="mt-3 block text-[15px] leading-[1.5] text-field-text/90">{p.whatToTry}</span>
                {p.note && <span className="mt-2 block text-[14px] text-review">{p.note}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="path" className="space-y-4">
        <h2 id="path" className="text-[16px] font-medium">
          The path through it
        </h2>
        <ol className="space-y-3">
          {PATH.map(({ step, built }, i) => (
            <li key={step} className="flex gap-3.5 text-[15px] leading-[1.5]">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[13px]",
                  built ? "border-signal/50 text-signal" : "border-field-hairline text-field-inert",
                )}
              >
                {i + 1}
              </span>
              <span className={built ? "text-field-text/90" : "text-field-inert"}>
                {step}
                {!built && <span className="ml-2 rounded-md border border-field-hairline px-1.5 py-0.5 text-[12px] text-field-muted">Not built yet</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="border-t border-field-hairline pt-6 text-[15px] text-field-muted">
        Have an account?{" "}
        <Link href="/sign-in" className="text-field-text underline decoration-field-hairline underline-offset-[5px] hover:decoration-field-text">
          Sign in
        </Link>
      </p>
    </div>
  );
}
