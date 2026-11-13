import Link from "next/link";
import { ArrowRight } from "lucide-react";
import credits from "@/public/images/life/credits.json";
import { REPO_URL } from "./SiteHeader";
import { Wordmark } from "./Wordmark";

type Credit = { page: string; title: string; creator: string; license: string; licenseUrl: string };

const link = "text-[#C9D6CF] underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** The public footer: one last invitation to check, the site's map, and what the licences ask us to say. */
export function SiteFooter() {
  const photos = credits as Credit[];
  // the one-click roles exist only on a demo deployment; this footer is rendered on the server
  const demo = process.env.DEMO_MODE === "true";
  const columns = [
    {
      title: "Explore",
      links: [
        { href: "/atlas", label: "Impact atlas" },
        { href: "/#how", label: "How it works" },
        { href: "/trust", label: "What it proves, and what it does not" },
      ],
    },
    {
      title: "Check for yourself",
      links: [
        { href: "/verify", label: "Check a photo or a proof id" },
        { href: "/trust#checks", label: "Every automatic check" },
        ...(demo ? [{ href: "/demo", label: "Try each role in the demo" }] : []),
      ],
    },
    {
      title: "Organisations",
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

  return (
    <footer className="bg-[#0E2A22] text-[#F4F1EA] print:hidden">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-16">
        {/* the invitation */}
        <div className="flex flex-wrap items-end justify-between gap-8 border-b border-white/10 py-14">
          <div className="max-w-[40ch] space-y-3">
            <p className="font-serif text-[34px] leading-[1.1] tracking-[-0.015em] sm:text-[40px]">Do not take our word for it.</p>
            <p className="text-[16px] leading-[1.6] text-[#C9D6CF]">Open a site, read who reviewed it and why, and check a record in your own browser.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/atlas"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#C7F36B] px-5 text-[15px] font-medium text-[#0E2A22] transition-colors hover:bg-[#D6F78F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore the atlas
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/verify"
              className="inline-flex h-12 items-center rounded-lg border border-white/25 px-5 text-[15px] text-white transition-colors hover:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Check a photo
            </Link>
          </div>
        </div>

        {/* the map of the site */}
        <div className="grid gap-x-10 gap-y-12 py-14 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
          <div className="max-w-[40ch] space-y-4 sm:col-span-2 lg:col-span-1">
            <Wordmark tone="light" />
            <p className="text-[15px] leading-[1.6] text-[#C9D6CF]">Restoration claims anyone can check: the evidence, the reviewer and the review itself.</p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="space-y-4">
              <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#8FB5A3]">{col.title}</h2>
              <ul className="space-y-2.5 text-[15px]">
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

        {/* what this is, and what the licences ask for: who made each picture and what we changed */}
        <div className="space-y-3 border-t border-white/10 py-8 text-[13px] leading-[1.6] text-[#9DB3A9]">
          <p className="text-[#C9D6CF]">
            An open-source demonstration. Every project, organisation and record on this site is demonstration data. An approved record is not proof that trees were planted.
          </p>
          <p>The hero paintings are illustrations of delta landscapes, not maps of the demo sites. Their plots and readings are examples, not records.</p>
          <p>
            Photographs in “What the evidence protects”:{" "}
            {photos.map((c, i) => (
              <span key={c.page}>
                {i > 0 && (i === photos.length - 1 ? " and " : ", ")}
                <a href={c.page} className="underline underline-offset-2 hover:text-white">
                  “{c.title}”
                </a>{" "}
                by {c.creator} (
                <a href={c.licenseUrl} className="underline underline-offset-2 hover:text-white">
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
