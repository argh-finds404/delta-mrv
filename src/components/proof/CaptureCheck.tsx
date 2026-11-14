"use client";

import * as React from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { captureStatement, verifyCaptureSignature } from "@/src/lib/capture-statement";

/**
 * X2 on the proof page: whether the capturing device signed this record's photos, checked again
 * here, in the visitor's browser, from the fingerprints shown on the page. A server's "verified"
 * is not taken on its word.
 */
export function CaptureCheck({
  projectId,
  files,
  capture,
}: {
  projectId: string;
  files: { role: "BEFORE" | "AFTER" | "SUPPLEMENT"; round: number; sha256: string }[];
  capture: { publicKey: string; signature: string; signedAt: string } | null;
}) {
  const [state, setState] = React.useState<"checking" | "valid" | "invalid">("checking");
  React.useEffect(() => {
    if (!capture) return;
    const pair = files.filter((f): f is typeof f & { role: "BEFORE" | "AFTER" } => f.round === 1 && f.role !== "SUPPLEMENT");
    let ignore = false;
    void verifyCaptureSignature(captureStatement(projectId, pair, capture.signedAt), capture).then((ok) => !ignore && setState(ok ? "valid" : "invalid"));
    return () => {
      ignore = true;
    };
  }, [projectId, files, capture]);

  if (!capture) {
    return (
      <p className="flex items-start gap-2.5 text-[15px] leading-[1.6]" data-testid="capture-badge" data-state="standard">
        <ShieldCheck className="mt-1 size-4 shrink-0 text-paper-muted" aria-hidden />
        <span>
          <span className="font-medium">Standard SHA-256 fingerprints.</span> <span className="text-paper-muted">The photos were sent without a device signature.</span>
        </span>
      </p>
    );
  }
  const when = new Date(capture.signedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return (
    <p className="flex items-start gap-2.5 text-[15px] leading-[1.6]" data-testid="capture-badge" data-state={state}>
      <KeyRound className={`mt-1 size-4 shrink-0 ${state === "invalid" ? "text-fraud" : "text-paper-seal"}`} aria-hidden />
      <span role="status">
        <span className="font-medium">
          {state === "checking" ? "Device-signed capture, checking the signature…" : state === "valid" ? "Device-signed capture, checked in your browser." : "A device signature is recorded, but it does not match these fingerprints."}
        </span>{" "}
        <span className="text-paper-muted">
          The capturing browser signed the two fingerprints below with its own key, by its clock at {when} UTC. The key is held by a browser, not a hardware chip: this shows the fingerprints were
          fixed on that device, not where or when the photos were taken.
        </span>
      </span>
    </p>
  );
}
