import { cn } from "@/src/lib/utils";

// The auth forms' controls, one size everywhere: 48px controls with 16px text (no zoom on iOS).

export const authLabel = "block text-[14px] font-medium text-field-text";

export const authField = (invalid = false) =>
  cn(
    "h-12 w-full rounded-lg border bg-field-canopy px-3.5 text-[16px] text-field-text transition-colors placeholder:text-field-inert",
    "focus-visible:outline-none focus-visible:ring-2",
    invalid ? "border-fraud focus-visible:ring-fraud/60" : "border-field-hairline hover:border-field-inert focus-visible:border-signal focus-visible:ring-signal/40",
  );

export const authPrimary =
  "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-signal px-5 text-[16px] font-medium text-field-abyss transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-wait disabled:opacity-70";
