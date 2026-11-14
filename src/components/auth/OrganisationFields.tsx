"use client";

import { Building2, Check, Coins, ShieldCheck } from "lucide-react";
import type { OrgDetails } from "@/src/components/auth/create-organisation";
import { cn } from "@/src/lib/utils";

/**
 * The organisation a new account registers: its name, country, website and type, the type as three
 * cards, never a dropdown (docs/15-UI-STATES.md §6). Shared by /sign-up and /sign-up/finish.
 */
export function OrganisationFields({ value, onChange, error }: { value: OrgDetails; onChange: (patch: Partial<OrgDetails>) => void; error?: string }) {
  return (
    <>
    <div className="space-y-1.5">
      <label
        htmlFor="orgName"
        className="block text-[14px] font-medium text-field-text"
      >
        Organisation legal name
      </label>
      <input
        id="orgName"
        type="text"
        value={value.name}
        onChange={(e) => {
          onChange({ name: e.target.value });
        }}
        required
        className={cn(
          "h-12 w-full rounded-lg border px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 transition-colors",
          error
            ? "border-fraud focus-visible:ring-fraud"
            : "border-field-hairline focus-visible:ring-signal"
        )}
        placeholder="e.g. Sundarbans Restoration Trust"
      />
      {error && (
        <p className="text-[13px] text-fraud">{error}</p>
      )}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label
          htmlFor="country"
          className="block text-[14px] font-medium text-field-text"
        >
          Country of registry
        </label>
        <input
          id="country"
          type="text"
          value={value.country}
          onChange={(e) => onChange({ country: e.target.value })}
          required
          className="h-12 w-full rounded-lg border border-field-hairline px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="website"
          className="block text-[14px] font-medium text-field-text"
        >
          Website (optional)
        </label>
        <input
          id="website"
          type="url"
          value={value.website}
          onChange={(e) => onChange({ website: e.target.value })}
          placeholder="https://example.org"
          className="h-12 w-full rounded-lg border border-field-hairline px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </div>
    </div>

    {/* ORGANISATION TYPE SELECTOR (Three Cards, Never a Dropdown - docs/15-UI-STATES.md §6) */}
    <div className="space-y-2">
      <label className="block text-[14px] font-medium text-field-text">
        Organisation type
      </label>

      <div className="space-y-2.5">
        {/* Card 1: Project Owner */}
        <button
          type="button"
          onClick={() => onChange({ type: "OWNER" })}
          aria-pressed={value.type === "OWNER"}
          className={cn(
            "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-field-text cursor-pointer",
            value.type === "OWNER"
              ? "border-field-text bg-field-raised/80"
              : "border-field-hairline bg-field-canopy hover:bg-field-raised/40"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className={cn("size-4", value.type === "OWNER" ? "text-field-text" : "text-field-muted")} />
              <span className="text-[15px] font-medium text-field-text">Project owner</span>
            </div>
            {value.type === "OWNER" && (
              <span className="flex size-4 items-center justify-center rounded-full bg-field-text text-field-abyss">
                <Check className="size-3 stroke-[3]" />
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] leading-[1.5] text-field-muted pl-6">
            You run restoration projects and submit evidence
          </p>
        </button>

        {/* Card 2: Independent Verifier */}
        <button
          type="button"
          onClick={() => onChange({ type: "VERIFIER" })}
          aria-pressed={value.type === "VERIFIER"}
          className={cn(
            "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-field-text cursor-pointer",
            value.type === "VERIFIER"
              ? "border-field-text bg-field-raised/80"
              : "border-field-hairline bg-field-canopy hover:bg-field-raised/40"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn("size-4", value.type === "VERIFIER" ? "text-field-text" : "text-field-muted")} />
              <span className="text-[15px] font-medium text-field-text">Independent verifier</span>
            </div>
            {value.type === "VERIFIER" && (
              <span className="flex size-4 items-center justify-center rounded-full bg-field-text text-field-abyss">
                <Check className="size-3 stroke-[3]" />
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] leading-[1.5] text-field-muted pl-6">
            You review other organisations&apos; evidence
          </p>
        </button>

        {/* Card 3: Funder */}
        <button
          type="button"
          onClick={() => onChange({ type: "FUNDER" })}
          aria-pressed={value.type === "FUNDER"}
          className={cn(
            "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-field-text cursor-pointer",
            value.type === "FUNDER"
              ? "border-field-text bg-field-raised/80"
              : "border-field-hairline bg-field-canopy hover:bg-field-raised/40"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Coins className={cn("size-4", value.type === "FUNDER" ? "text-field-text" : "text-field-muted")} />
              <span className="text-[15px] font-medium text-field-text">Funder</span>
            </div>
            {value.type === "FUNDER" && (
              <span className="flex size-4 items-center justify-center rounded-full bg-field-text text-field-abyss">
                <Check className="size-3 stroke-[3]" />
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] leading-[1.5] text-field-muted pl-6">
            You fund projects and review verified outcomes
          </p>
        </button>
      </div>

      {/* Crucial conflict-of-interest notice (docs/15-UI-STATES.md §6) */}
      <p className="mt-2 text-[14px] leading-[1.5] text-field-muted">
        Organisation type determines what you can do. A project owner cannot
        review evidence, including its own. This cannot be changed later
        without administrator approval.
      </p>
    </div>
    </>
  );
}
