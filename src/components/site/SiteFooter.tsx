import Link from "next/link";
import credits from "@/public/images/life/credits.json";
import { REPO_URL } from "./SiteHeader";
import { Wordmark } from "./Wordmark";

type Credit = { page: string; title: string; creator: string; license: string; licenseUrl: string };

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/atlas", label: "Impact atlas" },
      { href: "/verify", label: "Reverse verification" },
      { href: "/trust", label: "Trust & limits" },
      { href: "/#how", label: "How it works" },
      { href: "/#limits", label: "What it proves" },
    ],
  },
  {
    title: "For organisations",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/sign-up", label: "Create an organisation" },
    ],
  },
  {
    title: "Open source",
    links: [
      { href: REPO_URL, label: "Source code" },
      { href: `${REPO_URL}/blob/main/docs/THREAT_MODEL.md`, label: "Threat model" },
      { href: `${REPO_URL}/tree/main/docs/adr`, label: "Design decisions" },
    ],
  },
];

const link = "text-paper-muted underline-offset-4 transition-colors hover:text-paper-ink hover:underline";

export function SiteFooter() {
  const photos = credits as Credit[];
  return (
    <footer className="border-t border-paper-rule">
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-16">
        <div className="grid gap-12 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-[44ch] space-y-3">
            <Wordmark />
            <p className="text-[15px] leading-[1.6] text-paper-muted">
              Restoration claims anyone can check: the evidence, the reviewer and the review itself.
            </p>
            <p className="text-[13px] leading-normal text-paper-muted">
              An open-source demonstration. Every project, organisation and record on this site is demonstration data.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="space-y-3">
              <h2 className="text-[13px] text-paper-ink">{col.title}</h2>
              <ul className="space-y-2 text-[15px]">
                {col.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className={link}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* What the licences ask for: who made each picture, under which licence, and what we changed. */}
        <div className="mt-12 space-y-2 border-t border-paper-rule pt-6 text-[12px] leading-normal text-paper-muted">
          <p>
            The hero paintings are illustrations drawn in code; their plots, readings and coordinates are examples, not records.
          </p>
          <p>
            Photographs in “What the evidence protects”:{" "}
            {photos.map((c, i) => (
              <span key={c.page}>
                {i > 0 && (i === photos.length - 1 ? " and " : ", ")}
                <a href={c.page} className="underline underline-offset-2 hover:text-paper-ink">
                  “{c.title}”
                </a>{" "}
                by {c.creator} (
                <a href={c.licenseUrl} className="underline underline-offset-2 hover:text-paper-ink">
                  {c.license}
                </a>
                )
              </span>
            ))}
            , shown cropped. Map tiles and satellite imagery are credited on the map itself.
          </p>
        </div>
      </div>
    </footer>
  );
}
