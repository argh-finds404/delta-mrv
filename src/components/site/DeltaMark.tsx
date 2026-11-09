import { cn } from "@/src/lib/utils";

/**
 * The mark: a river delta, which is literally a Δ. Mangrove land fans out from one source, its
 * channels branch to the sea, and a lime shoreline holds it. In motion (slowly, endlessly) water
 * flows down the channels and the tide line breathes; with reduced motion it is a still.
 * The flow and the tide live in globals.css (.delta-flow, .delta-tide).
 */
export function DeltaMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M16 3.2 28.9 26.9c.4.8-.1 1.6-1 1.6H4.1c-.9 0-1.4-.8-1-1.6Z" fill="#2F6B4F" />
      <path d="M16 3.2 28.9 26.9c.4.8-.1 1.6-1 1.6H4.1c-.9 0-1.4-.8-1-1.6Z" fill="none" stroke="#1E4A36" strokeWidth="0.9" strokeLinejoin="round" />
      <g className="delta-flow" fill="none" stroke="#BFEFE6" strokeWidth="1.35" strokeLinecap="round">
        <path d="M16 8.2c-.8 6-4.5 11.4-7.8 19" />
        <path d="M16 8.2c.3 7-.4 12.8 0 19" />
        <path d="M16 8.2c1 5.8 4.6 11.4 7.8 19" />
        <path d="M13.5 17.6c-1.2 3-.8 6.4-2 9.6" />
        <path d="M18.6 17.6c1.4 3 .8 6.4 2 9.6" />
      </g>
      <circle cx="16" cy="8.2" r="1.25" fill="#D7F6B8" />
      <path className="delta-tide" d="M4.5 30.6h23" stroke="#D7F6B8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
