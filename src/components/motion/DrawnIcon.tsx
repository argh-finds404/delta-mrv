import { cn } from "@/src/lib/utils";

// Icons that draw themselves once as they appear, the way a reviewer's pen ticks a line (after
// the animated icon sets such as itshover's): a circle, then its mark. CSS stroke animation on SVG
// paths, no script; with reduced motion they are simply there. The meaning is always in the text
// beside them too: never told by the icon or its colour alone.

const MARKS = {
  check: "M7.5 12.5l3 3 6-7",
  cross: "M8.5 8.5l7 7M15.5 8.5l-7 7",
  dash: "M8 12h8",
  mail: "M5.5 8.5h13v8h-13zM5.5 9l6.5 4.5L18.5 9",
} as const;

export function DrawnIcon({ mark, className, circle = true }: { mark: keyof typeof MARKS; className?: string; circle?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("drawn-icon size-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {circle && <circle cx="12" cy="12" r="9.25" pathLength={1} className="drawn-icon-ring" />}
      <path d={MARKS[mark]} pathLength={1} className="drawn-icon-mark" />
    </svg>
  );
}
