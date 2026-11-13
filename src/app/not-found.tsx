import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/src/components/site/SiteFooter";
import { SiteHeader } from "@/src/components/site/SiteHeader";

export const metadata: Metadata = { title: "Not found · Delta" };

/** Every address that leads nowhere, and every record the caller may not see (docs/05-ROUTES.md §7). */
export default function NotFound() {
  return (
    <div data-theme="paper" className="min-h-dvh bg-paper font-sans text-paper-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] space-y-6 px-6 py-20 lg:py-28">
        <h1 className="type-display">This page could not be found</h1>
        <p className="max-w-[56ch] text-[17px] leading-[1.6] text-paper-muted">
          The address is wrong, or the record is not one you can see. A record that is private to another organisation looks the same as one that does not exist.
        </p>
        <p className="flex flex-wrap gap-x-6 gap-y-2 text-[16px]">
          <Link href="/" className="underline decoration-paper-rule underline-offset-[5px] hover:decoration-paper-ink">
            Home
          </Link>
          <Link href="/atlas" className="underline decoration-paper-rule underline-offset-[5px] hover:decoration-paper-ink">
            The map of sites
          </Link>
          <Link href="/verify" className="underline decoration-paper-rule underline-offset-[5px] hover:decoration-paper-ink">
            Check a photo or a proof id
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
