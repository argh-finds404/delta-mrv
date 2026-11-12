"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/src/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut().catch(() => null);
        router.push("/");
        router.refresh();
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[14px] text-field-muted transition-colors hover:bg-field-raised hover:text-field-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-60"
    >
      <LogOut className="size-4" aria-hidden />
      <span className="hidden sm:inline">{busy ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
