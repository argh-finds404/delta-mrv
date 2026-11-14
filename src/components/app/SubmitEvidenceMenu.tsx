"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, ChevronDown } from "lucide-react";

const primary =
  "inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

/** "Submit evidence": straight to the form with one project, a short list to choose from with several. */
export function SubmitEvidenceMenu({ projects }: { projects: { id: string; title: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key !== "Escape" : box.current?.contains(e.target as Node)) return;
      setOpen(false);
      if (e instanceof KeyboardEvent) trigger.current?.focus(); // Escape returns focus to the button that opened it
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  if (projects.length === 1) {
    return (
      <Link href={`/projects/${projects[0]!.id}/submit`} className={primary}>
        <Camera className="size-[18px]" aria-hidden />
        Submit evidence
      </Link>
    );
  }
  return (
    <div ref={box} className="relative">
      <button ref={trigger} type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)} className={primary}>
        <Camera className="size-[18px]" aria-hidden />
        Submit evidence
        <ChevronDown className="size-4" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(340px,calc(100vw-32px))] sm:left-auto sm:right-0 rounded-2xl border border-field-hairline bg-field-canopy p-2 shadow-[0_12px_32px_rgba(20,30,25,0.14)]">
          <p className="px-3 pb-1 pt-2 text-[13px] text-field-muted">For which project?</p>
          <ul>
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}/submit`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-[15px] transition-colors hover:bg-field-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
