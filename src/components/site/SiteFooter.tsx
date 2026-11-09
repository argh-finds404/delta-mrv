import Link from "next/link";
import { REPO_URL } from "./SiteHeader";
import { Wordmark } from "./Wordmark";
import credits from "@/public/images/life/credits.json";

interface CreditItem {
  page: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
}

const creditList = credits as CreditItem[];

const LINKS = [
  { href: "/atlas", label: "Impact atlas" },
  { href: "/sign-in", label: "Sign in" },
  { href: REPO_URL, label: "Source code" },
  { href: `${REPO_URL}/blob/main/docs/THREAT_MODEL.md`, label: "Threat model" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-paper-rule">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-6 py-16 md:grid-cols-[1fr_auto] lg:px-16">
        <div className="max-w-[46ch] space-y-3">
          <Wordmark />
          <p className="text-[13px] leading-[1.5] text-paper-muted">
            An open-source demonstration of independent verification for restoration evidence. The data on this site is
            demonstration data.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-[15px] md:justify-end">
          {LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className="text-paper-muted underline-offset-4 transition-colors hover:text-paper-ink hover:underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
        {/* The licences ask for this: who made each source picture, its licence, and that we changed it. */}
        <p className="text-[12px] leading-normal text-paper-muted md:col-span-2">
          Photographs:{" "}
          {creditList.map((c, i) => (
            <span key={c.page}>
              {i > 0 && " and "}
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
          . Shown cropped; the annotations drawn over them are illustrations. The atlas imagery is credited on the map.
        </p>
      </div>
    </footer>
  );
}
