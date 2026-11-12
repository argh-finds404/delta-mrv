import Link from "next/link";
import { Wordmark } from "@/src/components/site/Wordmark";
import { cn } from "@/src/lib/utils";
import { SignOutButton } from "./SignOutButton";

// The workspace frame: one top bar, no sidebars. Every signed-in page sits inside it.

export type AppTab = "overview" | "review" | "atlas";

export interface AppShellProps {
  active?: AppTab;
  userName: string;
  /** Shown as the second line beside the avatar: the organisation, or the role. */
  context?: string;
  /** Verifiers get the Review tab, with how many submissions wait for them. */
  review?: { count: number } | null;
  children: React.ReactNode;
  /** A full-height page (the Lab) manages its own scrolling below the bar. */
  fill?: boolean;
}

const HUES = ["#13896F", "#2F78C4", "#7A57D1", "#D9772B", "#C8402B", "#4E9A2F"];
const hueFor = (s: string) => HUES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]!;

export function AppShell({ active, userName, context, review, children, fill = false }: AppShellProps) {
  const tabs: { id: AppTab; href: string; label: string; badge?: number }[] = [
    { id: "overview", href: "/dashboard", label: "Overview" },
    ...(review ? [{ id: "review" as const, href: "/lab", label: "Review", badge: review.count }] : []),
    { id: "atlas", href: "/atlas", label: "Atlas" },
  ];
  const initial = (userName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className={cn("bg-field-abyss font-sans text-field-text", fill ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh")}>
      <header className="sticky top-0 z-40 shrink-0 border-b border-field-hairline bg-field-canopy">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" aria-label="Delta, overview" className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">
            <Wordmark />
          </Link>
          <nav aria-label="Workspace" className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const on = t.id === active;
              return (
                <Link
                  key={t.id}
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                    on ? "bg-field-raised font-medium text-field-text" : "text-field-muted hover:bg-field-raised/70 hover:text-field-text",
                  )}
                >
                  {t.label}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="rounded-full bg-signal px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">{t.badge > 99 ? "99+" : t.badge}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2.5 md:flex">
              <span aria-hidden className="flex size-8 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: hueFor(userName) }}>
                {initial}
              </span>
              <span className="leading-tight">
                <span className="block max-w-[180px] truncate text-[14px] font-medium">{userName}</span>
                {context && <span className="block max-w-[180px] truncate text-[12px] text-field-muted">{context}</span>}
              </span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      {fill ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </div>
  );
}
