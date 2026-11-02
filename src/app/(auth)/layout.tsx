import * as React from "react";
import { ProofPreview } from "@/src/components/auth/ProofPreview";
import { sampleAnchoredRecord } from "@/src/components/auth/fixtures";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-field-abyss md:flex-row">
      {/* Mobile-only Collapsed Proof Bar (Docs/15-UI-STATES.md §6) */}
      <ProofPreview
        record={sampleAnchoredRecord}
        mode="collapsed"
        className="md:hidden"
      />

      {/* Desktop Left Panel (45% on --field-canopy) */}
      <aside className="hidden w-full md:flex md:w-[45%] flex-col border-r border-field-hairline bg-field-canopy">
        <ProofPreview record={sampleAnchoredRecord} mode="full" />
      </aside>

      {/* Right Panel (55% on --field-abyss) */}
      <main className="flex w-full md:w-[55%] flex-1 items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-[440px] py-4">
          {children}
        </div>
      </main>
    </div>
  );
}

