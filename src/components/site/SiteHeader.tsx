import Link from "next/link";
import { Wordmark } from "./Wordmark";

export const REPO_URL = "https://github.com/argh-finds404/delta-mrv";

const NAV = [
  { href: "/atlas", label: "Atlas", always: true },
  { href: "/#how", label: "How it works" },
  { href: "/trust", label: "What it proves" },
  { href: "/verify", label: "Check a photo" },
  { href: REPO_URL, label: "Source" },
];

const focus = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper-ink";

/** Public (Paper) header. One hairline below, no shadow, no blur: it is a page edge, not a layer. */
export function SiteHeader() {
  // the one-click roles exist only on a demo deployment; this header is rendered on the server
  const demo = process.env.DEMO_MODE === "true";
  return (
    <header className="sticky top-0 z-40 border-b border-paper-rule bg-paper print:hidden">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-6 lg:px-16">
        <Link href="/" className={focus} aria-label="Delta, home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6 text-[15px]">
          {NAV.map(({ href, label, always }) => (
            <Link key={href} href={href} className={`${focus} text-paper-muted transition-colors hover:text-paper-ink ${always ? "" : "hidden md:inline"}`}>
              {label}
            </Link>
          ))}
          <Link
            href="/sign-in"
            className={`${focus} text-paper-muted transition-colors hover:text-paper-ink ${demo ? "hidden sm:inline" : "inline-flex h-10 items-center rounded-lg border border-paper-rule px-4 !text-paper-ink hover:border-paper-muted"}`}
          >
            Sign in
          </Link>
          {demo && (
            <Link
              href="/demo"
              className="inline-flex h-10 items-center rounded-lg bg-paper-ink px-4 font-medium text-paper transition-colors hover:bg-[#22302C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-ink"
            >
              Try the demo
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
