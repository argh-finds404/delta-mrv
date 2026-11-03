"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  Coins,
  ArrowRight,
  Info,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { signInAsDemo } from "./actions";

export interface DemoPersona {
  id: string;
  roleTitle: string;
  organization: string;
  orgType: "OWNER" | "VERIFIER" | "FUNDER";
  whatToTry: string;
  note?: string;
  email: string;
}

export interface DemoPageProps {
  onSelectPersona?: (persona: DemoPersona) => void;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "persona-owner",
    roleTitle: "Field submitter",
    organization: "Sundarbans Restoration Trust",
    orgType: "OWNER",
    email: "submitter@delta-demo.example",
    whatToTry:
      "Submit before/after evidence against a project site and observe real-time perceptual hashing.",
  },
  {
    id: "persona-verifier-1",
    roleTitle: "Independent verifier one",
    organization: "Delta Independent Audit",
    orgType: "VERIFIER",
    email: "verifier1@delta-demo.example",
    whatToTry:
      "Review a queue with a flagged duplicate, inspect forensic drill-downs, then approve.",
    note: "Approval needs two verifiers. Sign in as verifier two afterwards to complete it.",
  },
  {
    id: "persona-verifier-2",
    roleTitle: "Independent verifier two",
    organization: "Delta Independent Audit",
    orgType: "VERIFIER",
    email: "verifier2@delta-demo.example",
    whatToTry:
      "Provide the second independent approval to satisfy quorum and reach APPROVED status.",
  },
  {
    id: "persona-funder",
    roleTitle: "Funder",
    organization: "Coastal Resilience Fund",
    orgType: "FUNDER",
    email: "funder@delta-demo.example",
    whatToTry:
      "Inspect verified ecological outcomes, audit trails, and anchored Merkle proofs across portfolio projects.",
  },
];

export const DEMO_SIX_STEPS = [
  "Sign in as the field submitter, submit before/after evidence",
  "Findings appear, including a flagged duplicate",
  "Switch to verifier one, review, approve",
  "Switch to verifier two, approve — status becomes APPROVED",
  "Click \"Anchor now\"",
  "Open the public proof page, drop in the original photo, watch it verify green against the chain",
];

/**
 * DemoPage — One-click role switcher for evaluating the trust architecture.
 * Authority: docs/15-UI-STATES.md §6 and docs/11-IMPLEMENTATION.md §3.
 * No password fields, no synthetic logins. Each persona enters a seeded role.
 */
export default function DemoPage({ onSelectPersona }: DemoPageProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSelect = async (persona: DemoPersona) => {
    setSelectedId(persona.id);
    setError(null);
    if (onSelectPersona) {
      onSelectPersona(persona);
      return;
    }
    // A real session for a seeded user. The server action checks DEMO_MODE itself and is
    // given only the persona id, so it cannot be used to sign in as anyone else.
    const res = await signInAsDemo(persona.id);
    if (!res.success) {
      setError(res.error ?? "Could not start the demo session.");
      setSelectedId(null);
      return;
    }
    // shortcut: everyone lands on /lab until Stage 3 builds /dashboard (docs/05 §3)
    router.push("/lab");
  };

  return (
    <div className="space-y-6 text-field-text">
      {/* Title */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-field-text">
            Demo persona switcher
          </h1>
          <span className="rounded border px-2 py-0.5 text-[11px] text-field-muted bg-field-raised border-field-hairline">
            Demo mode
          </span>
        </div>
        <p className="text-xs text-field-muted">
          Select any seeded organisation role to inspect tenancy, conflict-of-interest gates, and 2-of-N quorum.
        </p>
      </div>

      {/* 60-Second Demo Path (docs/11-IMPLEMENTATION.md §3) */}
      <div className="rounded-lg border border-field-hairline bg-field-canopy/70 p-4 space-y-2.5">
        <div className="flex items-center justify-between border-b border-field-hairline/60 pb-2">
          <span className="text-xs font-medium font-sans text-field-text">
            The 60-second demo path
          </span>
          <span className="text-[11px] text-field-muted">
            docs/11 §3
          </span>
        </div>

        <ol className="space-y-1.5 text-xs text-field-muted list-none">
          {DEMO_SIX_STEPS.map((stepText, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-xs bg-field-raised font-mono text-[10px] text-field-text font-medium border border-field-hairline">
                {idx + 1}
              </span>
              <span className="text-field-muted text-xs leading-tight">
                {stepText}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <p role="alert" className="rounded border border-[color-mix(in_srgb,var(--fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--fraud)_14%,transparent)] p-3 text-xs text-fraud">
          {error}
        </p>
      )}

      {/* Four Persona Cards */}
      <div className="space-y-3">
        {DEMO_PERSONAS.map((persona) => {
          const isSelected = selectedId === persona.id;
          const Icon =
            persona.orgType === "OWNER"
              ? Building2
              : persona.orgType === "VERIFIER"
              ? ShieldCheck
              : Coins;

          return (
            <div
              key={persona.id}
              className={cn(
                "rounded-lg border p-4 space-y-2.5 transition-colors",
                isSelected
                  ? "border-field-text bg-field-raised/90"
                  : "border-field-hairline bg-field-canopy hover:border-field-hairline/90"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-field-muted shrink-0" />
                    <h2 className="text-xs font-semibold text-field-text">
                      {persona.roleTitle}
                    </h2>
                    <span className="rounded border px-1.5 py-0.2 text-[10px] text-field-muted border-field-hairline">
                      {persona.orgType === "OWNER" ? "Owner" : persona.orgType === "VERIFIER" ? "Verifier" : "Funder"}
                    </span>
                  </div>
                  <p className="text-xs text-field-muted pl-6">
                    {persona.organization}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelect(persona)}
                  className="inline-flex items-center gap-1.5 rounded bg-signal px-3 py-1.5 text-xs font-medium text-[#0A0C0B] hover:bg-signal/90 transition-colors shrink-0 cursor-pointer"
                >
                  <span>Launch session</span>
                  <ArrowRight className="size-3" />
                </button>
              </div>

              <div className="pl-6 space-y-1.5 text-xs">
                <p className="text-field-muted">
                  <span className="text-field-text font-medium">What to try: </span>
                  {persona.whatToTry}
                </p>

                {persona.note && (
                  <div className="flex items-start gap-1.5 text-[11px] text-review bg-[#E8A33D]/10 rounded p-2 border border-[#E8A33D]/20">
                    <Info className="size-3.5 shrink-0 mt-0.5" />
                    <span>{persona.note}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Auxiliary link */}
      <div className="pt-2 border-t border-field-hairline flex items-center justify-between text-xs">
        <span className="text-field-muted">Returning to production?</span>
        <Link
          href="/sign-in"
          className="text-signal hover:underline transition-colors flex items-center gap-1"
        >
          <span>Sign in normally</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
