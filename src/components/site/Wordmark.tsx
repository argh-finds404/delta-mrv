import { cn } from "@/src/lib/utils";
import { DeltaMark } from "./DeltaMark";

/** The mark and the name, set bold in the certificate face. `tone="light"` for dark grounds. */
export function Wordmark({ className, tone = "color" }: { className?: string; tone?: "color" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <DeltaMark className="size-7" tone={tone} />
      <span className="font-serif text-[23px] font-semibold leading-none tracking-[-0.02em]">Delta</span>
    </span>
  );
}
