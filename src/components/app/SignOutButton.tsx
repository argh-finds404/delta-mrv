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
        // The offline capture queue is cleared at sign-out (docs/16-AMENDMENTS-v2.md A11), but never
        // silently: unsent photos exist nowhere else, so the person is told and can stay signed in.
        const vault = await import("@/src/components/submit/offline-vault");
        const waiting = await vault.countOfflineDrafts().catch(() => 0);
        if (
          waiting > 0 &&
          !window.confirm(
            `${waiting} ${waiting === 1 ? "submission is" : "submissions are"} saved on this device and not sent yet. Signing out removes ${waiting === 1 ? "it" : "them"} from this device for good.

Sign out anyway?`,
          )
        ) {
          return;
        }
        setBusy(true);
        await vault.clearOfflineDrafts().catch(() => null);
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
