"use client";

import * as React from "react";
import { submitEvidenceAction } from "@/app/actions/evidence";
import { type EvidenceProcessingResult } from "@/src/server/services/forensics.service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, CheckCircle2, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

export function EvidenceUploader() {
  const [file, setFile] = React.useState<File | null>(null);
  const [projectSlug, setProjectSlug] = React.useState("sundarbans-mangroves");
  const [longitude, setLongitude] = React.useState("89.2465");
  const [latitude, setLatitude] = React.useState("21.9497");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<EvidenceProcessingResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select an image file to verify.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectSlug", projectSlug);
    if (longitude) formData.append("longitude", longitude);
    if (latitude) formData.append("latitude", latitude);

    try {
      const response = await submitEvidenceAction(formData);
      if (response.error) {
        setError(response.error);
      } else {
        setResult(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="bg-[#172623] border-white/10 text-neutral-100 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#D7F6B8]" />
              Evidence Verification Pipeline
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Multimodal Forensics: 64-bit dHash, PostGIS GPS geofencing &amp; Gemini 2.5 Flash
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-[#D7F6B8]/30 text-[#D7F6B8] font-mono text-xs">
            ZERO-COST LOCAL STORAGE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-mono uppercase text-neutral-400">
                Project Slug
              </label>
              <Input
                value={projectSlug}
                onChange={(e) => setProjectSlug(e.target.value)}
                className="mt-1 bg-[#101A18] border-white/10 text-white font-mono text-sm"
                placeholder="project-slug"
                required
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-neutral-400">
                Fallback Longitude
              </label>
              <Input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="mt-1 bg-[#101A18] border-white/10 text-white font-mono tabular-nums text-sm"
                placeholder="89.2465"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-neutral-400">
                Fallback Latitude
              </label>
              <Input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="mt-1 bg-[#101A18] border-white/10 text-white font-mono tabular-nums text-sm"
                placeholder="21.9497"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-neutral-400">
              Evidence Photo
            </label>
            <div className="mt-1 flex items-center gap-3">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="bg-[#101A18] border-white/10 text-neutral-300 file:bg-[#172623] file:text-[#D7F6B8] file:border-0 file:rounded file:px-2 file:py-1 cursor-pointer"
              />
              <Button
                type="submit"
                disabled={isSubmitting || !file}
                className="bg-[#D7F6B8] text-[#101A18] hover:bg-[#D7F6B8]/90 font-medium shrink-0"
              >
                {isSubmitting ? (
                  <>
                    <Cpu className="size-4 animate-spin mr-2" />
                    Auditing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-4 mr-2" />
                    Verify &amp; Store
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 font-mono">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-white/10 bg-[#101A18] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-[#D7F6B8]" />
                <span className="font-semibold text-white">
                  Event #{result.verificationEventId} Authenticated
                </span>
              </div>
              <Badge
                className={
                  result.finalRiskScore < 0.3
                    ? "bg-[#D7F6B8] text-[#101A18] font-mono tabular-nums"
                    : "bg-amber-400/20 text-amber-300 font-mono tabular-nums"
                }
              >
                RISK SCORE: {result.finalRiskScore}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-2">
                <div className="text-neutral-400">SHA-256 HASH</div>
                <div className="break-all bg-[#172623] p-2 rounded text-neutral-200">
                  {result.sha256Hash}
                </div>

                <div className="text-neutral-400 mt-2">64-BIT dHASH (PERCEPTUAL)</div>
                <div className="break-all bg-[#172623] p-2 rounded text-[#D7F6B8] tabular-nums">
                  {result.dHash}
                </div>

                <div className="text-neutral-400 mt-2">GPS TELEMETRY (EXIF / SRID=4326)</div>
                <div className="bg-[#172623] p-2 rounded text-neutral-200 tabular-nums">
                  {result.exif.longitude !== null && result.exif.latitude !== null
                    ? `[${result.exif.longitude}, ${result.exif.latitude}] (${result.exif.deviceModel ?? "Device EXIF"})`
                    : `Fallback: [${longitude}, ${latitude}] (No EXIF in image)`}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-neutral-400">GEMINI AI FORENSICS ASSESSMENT</div>
                <div className="bg-[#172623] p-3 rounded space-y-2 text-neutral-200 font-sans text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span>Canopy Health:</span>
                    <span className="text-[#D7F6B8] uppercase">
                      {result.geminiAssessment.canopyHealth}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span>Vegetation Density:</span>
                    <span className="tabular-nums">
                      {result.geminiAssessment.vegetationDensityPct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span>Anti-Spoofing:</span>
                    <span className={result.geminiAssessment.antiSpoofingPassed ? "text-[#D7F6B8]" : "text-red-400"}>
                      {result.geminiAssessment.antiSpoofingPassed ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                  <div className="text-neutral-300 italic pt-1 border-t border-white/5">
                    &quot;{result.geminiAssessment.authenticityAssessment}&quot;
                  </div>
                </div>

                <div className="text-neutral-400 mt-2">DUPLICATE HAMMING DISTANCE (&lt;~&gt;)</div>
                <div className="bg-[#172623] p-2 rounded text-neutral-200 font-mono">
                  {result.duplicateCheck.isDuplicate ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      Duplicate detected! Distance: {result.duplicateCheck.closestDistance} (Event #{result.duplicateCheck.matchedEventId})
                    </span>
                  ) : (
                    <span className="text-[#D7F6B8]">Unique (No perceptual duplicates within threshold)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

