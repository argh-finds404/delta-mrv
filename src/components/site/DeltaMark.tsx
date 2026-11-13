import { cn } from "@/src/lib/utils";

const TONES = {
  // on paper and on the light workspace
  color: ["#0F3B2E", "#1F8A62", "#2F7FBF"],
  // on the dark footer and the app icon
  light: ["#F4F1EA", "#7FD8AE", "#7DBEF0"],
} as const;

/**
 * The mark: a delta, Δ, held open by three separate strokes. Two banks of land meet at the
 * source; the tide line closes the shape without touching either. Three parts that stand apart
 * and still make one figure, as the claimant, the independent reviewer and the public record do.
 * The same drawing is the app icon (src/app/icon.svg).
 */
export function DeltaMark({ className, title, tone = "color" }: { className?: string; title?: string; tone?: keyof typeof TONES }) {
  const [land, bank, tide] = TONES[tone];
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <g fill="none" strokeWidth="4.4" strokeLinecap="round">
        <path d="M13 9.6 5.7 23" stroke={land} />
        <path d="M19 9.6 26.3 23" stroke={bank} />
        <path d="M10.4 26.9h11.2" stroke={tide} />
      </g>
    </svg>
  );
}
