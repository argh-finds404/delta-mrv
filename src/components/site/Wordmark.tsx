import { cn } from "@/src/lib/utils";
import { DeltaMark } from "./DeltaMark";

/** The mark and the name, set bold in the certificate face. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <DeltaMark className="size-7" />
      <span className="font-serif text-[23px] font-semibold leading-none tracking-[-0.02em]">Delta</span>
    </span>
  );
}
