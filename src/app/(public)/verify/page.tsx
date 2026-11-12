import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/src/components/site/SiteFooter";
import { SiteHeader } from "@/src/components/site/SiteHeader";
import { ReverseLookup } from "@/src/components/verify/ReverseLookup";

export const metadata: Metadata = {
  title: "Check a photo · Delta",
  description: "Look up a photo, a proof id or a transaction hash among Delta's approved records. The photo never leaves your device.",
};

/** /verify (docs/16-AMENDMENTS-v2.md A7). */
export default function VerifyPage() {
  return (
    <div data-theme="paper" className="min-h-dvh bg-paper font-sans text-paper-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[760px] space-y-10 px-6 py-12 lg:py-16">
        <header className="space-y-4">
          <h1 className="type-display">Check a photo</h1>
          <p className="max-w-[56ch] text-[17px] leading-[1.6] text-paper-muted">
            Was this exact file part of an approved restoration record? Drop it in, or paste a proof id or a fingerprint. No account needed.
          </p>
        </header>
        <ReverseLookup />
        <p className="border-t border-paper-rule pt-6 text-[14px] leading-[1.6] text-paper-muted">
          A match means the file is byte-for-byte the one that was reviewed. It does not mean the photo shows what its caption says, or that the work on the ground happened.{" "}
          <Link href="/trust" className="text-paper-ink underline decoration-paper-rule underline-offset-[5px] hover:decoration-paper-ink">
            What Delta proves
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
