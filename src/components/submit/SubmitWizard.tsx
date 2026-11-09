"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  MapPin,
  RotateCcw,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { OfflineBanner } from "@/src/components/offline-banner/offline-banner";
import { StepperProgress, type StepItem } from "@/src/components/stepper-progress/stepper-progress";
import { ACTIVITY_LABEL } from "@/src/lib/format";
import { cn } from "@/src/lib/utils";

export interface SubmitWizardProps {
  projectId: string;
  projectTitle: string;
  activityType: string;
}

type EvidenceRole = "BEFORE" | "AFTER";

interface PhotoSlot {
  file: File | null;
  previewUrl: string | null;
  clientSha256: string | null;
  isHashing: boolean;
  error: string | null;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per doc 14 §6

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function SubmitWizard({
  projectId,
  projectTitle,
  activityType,
}: SubmitWizardProps) {
  const [before, setBefore] = React.useState<PhotoSlot>({
    file: null,
    previewUrl: null,
    clientSha256: null,
    isHashing: false,
    error: null,
  });

  const [after, setAfter] = React.useState<PhotoSlot>({
    file: null,
    previewUrl: null,
    clientSha256: null,
    isHashing: false,
    error: null,
  });

  const [note, setNote] = React.useState("");
  const [deviceGps, setDeviceGps] = React.useState<{ lat: number; lon: number } | null>(null);
  const [isGettingGps, setIsGettingGps] = React.useState(false);
  const [gpsError, setGpsError] = React.useState<string | null>(null);

  const isOnline = React.useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const offlineCount = 0; // nothing is queued offline until the capture queue (M14) exists

  // Submission pipeline state (honestly reflects that Stage 4 intake backend is pending)
  const [submissionState, setSubmissionState] = React.useState<"idle" | "pipeline">("idle");
  const [steps, setSteps] = React.useState<StepItem[]>([
    { id: "hash", label: "Client-side SHA-256 verification", status: "queued" },
    { id: "upload", label: "Private blob storage intake", status: "queued" },
    { id: "forensics", label: "Perceptual dHash & duplicate search", status: "queued" },
    { id: "geofence", label: "PostGIS ST_Covers boundary check", status: "queued" },
    { id: "quorum", label: "2-of-N independent verifier queue", status: "queued" },
  ]);

  const handleFileSelect = async (role: EvidenceRole, file: File | null) => {
    const updater = role === "BEFORE" ? setBefore : setAfter;

    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      updater((prev) => ({
        ...prev,
        error: `File exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
      }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    updater({
      file,
      previewUrl,
      clientSha256: null,
      isHashing: true,
      error: null,
    });

    try {
      const hash = await computeSha256(file);
      updater((prev) => ({
        ...prev,
        clientSha256: hash,
        isHashing: false,
      }));
    } catch {
      updater((prev) => ({
        ...prev,
        isHashing: false,
        error: "Failed to compute client SHA-256 checksum",
      }));
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }
    setIsGettingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setIsGettingGps(false);
      },
      (err) => {
        setGpsError(err.message || "Failed to retrieve coordinates");
        setIsGettingGps(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const canSubmit =
    Boolean(before.file && before.clientSha256) &&
    Boolean(after.file && after.clientSha256) &&
    !before.isHashing &&
    !after.isHashing;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Intake (Stage 4b) does not exist yet. Report exactly what happened: the photos were hashed
    // on this device and nothing was sent. A simulated "stored · checked · queued" run would tell a
    // field worker their evidence was saved when it was not (docs/12-AGENT-SCOPE.md §3, §8).
    setSubmissionState("pipeline");
    setSteps((s) =>
      s.map((step) =>
        step.id === "hash"
          ? { ...step, status: "done", value: "Computed on this device" }
          : step.id === "upload"
            ? { ...step, status: "failed", value: isOnline ? "Not sent: evidence intake is not built yet" : "Not sent: you are offline, and nothing is queued yet" }
            : { ...step, status: "skipped", value: "Runs after upload" },
      ),
    );
  };

  const handleReset = () => {
    setBefore({ file: null, previewUrl: null, clientSha256: null, isHashing: false, error: null });
    setAfter({ file: null, previewUrl: null, clientSha256: null, isHashing: false, error: null });
    setNote("");
    setDeviceGps(null);
    setSubmissionState("idle");
    setSteps((s) => s.map((step) => ({ ...step, status: "queued", value: undefined })));
  };

  return (
    <div className="space-y-6">
      <OfflineBanner
        theme="field"
        isOffline={!isOnline}
        queuedCount={offlineCount}
      />

      {/* 1. Context Header */}
      <header className="space-y-2 border-b border-field-hairline pb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-xs text-field-muted hover:text-field-text transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" />
            <span>Dashboard</span>
          </Link>
          <span className="text-field-hairline">/</span>
          <span className="text-xs font-mono uppercase tracking-wider text-signal">
            Evidence Intake
          </span>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-3 pt-1">
          <h1 className="text-2xl font-semibold tracking-tight text-field-text">
            Submit Restoration Evidence
          </h1>
          <span className="rounded-md border border-field-hairline bg-field-canopy px-2.5 py-1 text-xs font-mono text-field-muted">
            {ACTIVITY_LABEL[activityType as keyof typeof ACTIVITY_LABEL] ?? activityType}
          </span>
        </div>

        <p className="text-xs text-field-muted leading-relaxed max-w-xl">
          Pair intake requires both a <strong className="text-field-text">BEFORE</strong> and an{" "}
          <strong className="text-field-text">AFTER</strong> photograph. Files are hashed locally on
          your device before streaming directly to private storage.
        </p>

        <p className="text-xs font-mono text-field-muted pt-1">
          Project: <span className="text-field-text font-sans font-medium">{projectTitle}</span>
          <span className="text-field-inert ml-2 text-[11px]">({projectId})</span>
        </p>
      </header>

      {/* 2. Pipeline Execution / Status View */}
      {submissionState === "pipeline" ? (
        <div className="rounded-xl border border-field-hairline bg-field-canopy p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-field-text flex items-center gap-2">
              <AlertCircle className="size-4 text-review" />
              <span>Intake Pipeline Status</span>
            </h2>
            <p className="text-xs text-field-muted">
              Client hashes computed on device. Evidence intake service (Stage 4b) is pending implementation.
            </p>
          </div>

          <StepperProgress title="Intake Telemetry" steps={steps} theme="field" />

          <div className="flex flex-wrap items-center gap-3 border-t border-field-hairline pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-field-hairline bg-field-raised px-4 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors"
            >
              <RotateCcw className="size-3.5" />
              <span>Edit / Reset Form</span>
            </button>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-4 text-xs font-medium text-field-abyss hover:bg-[#B9EA5F] transition-colors"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        /* 4. Active Submit Form */
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Pair Upload Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PhotoCaptureCard
              role="BEFORE"
              label="1. Before Work"
              description="Site condition prior to planting or clearance"
              slot={before}
              onSelect={(file) => handleFileSelect("BEFORE", file)}
            />

            <PhotoCaptureCard
              role="AFTER"
              label="2. After Work"
              description="Restoration outcome at identical vantage point"
              slot={after}
              onSelect={(file) => handleFileSelect("AFTER", file)}
            />
          </div>

          {/* Optional Note */}
          <div className="rounded-xl border border-field-hairline bg-field-canopy p-4 space-y-2">
            <label htmlFor="submit-note" className="block text-xs font-medium text-field-text">
              Field Observations <span className="text-field-muted font-normal">(Optional)</span>
            </label>
            <textarea
              id="submit-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Tidal mudflat stabilized; 350 Rhizophora saplings planted in 2m grid."
              className="w-full rounded-lg border border-field-hairline bg-field-raised p-3 text-xs text-field-text placeholder:text-field-inert focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>

          {/* Optional Device Location (Labelled weak signal per doc 14 §6) */}
          <div className="rounded-xl border border-field-hairline bg-field-canopy p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-field-text block">Device Geolocation</span>
                <span className="text-[11px] font-mono text-field-muted">
                  Labelled as <span className="text-review font-semibold">weak signal</span> · Server checks embedded EXIF
                </span>
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isGettingGps}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-field-hairline bg-field-raised px-3 text-xs text-field-text hover:bg-field-canopy transition-colors disabled:opacity-50"
              >
                <MapPin className="size-3.5 text-signal" />
                <span>{isGettingGps ? "Acquiring…" : deviceGps ? "Re-acquire" : "Capture Location"}</span>
              </button>
            </div>

            {deviceGps && (
              <div className="flex items-center gap-2 rounded-lg bg-field-raised px-3 py-2 text-xs font-mono text-field-text">
                <CheckCircle2 className="size-3.5 text-verified" />
                <span>
                  {deviceGps.lat.toFixed(5)}° N, {deviceGps.lon.toFixed(5)}° E
                </span>
              </div>
            )}

            {gpsError && (
              <p className="text-xs text-fraud flex items-center gap-1.5">
                <AlertCircle className="size-3.5" />
                <span>{gpsError}</span>
              </p>
            )}
          </div>

          {/* Submission Gate */}
          <div className="space-y-3 border-t border-field-hairline pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-field-muted">
                {canSubmit ? (
                  <span className="text-verified flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    <span>Both photographs hashed and ready for transmission</span>
                  </span>
                ) : (
                  <span>Select both BEFORE and AFTER photographs to enable submission</span>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-signal",
                  canSubmit
                    ? "bg-signal text-field-abyss hover:bg-[#B9EA5F]"
                    : "bg-field-raised text-field-inert border border-field-hairline cursor-not-allowed",
                )}
              >
                <span>Submit for Independent Review</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-field-muted text-center sm:text-left">
              Delta is append-only. Once approved by two independent reviewer organisations, records cannot be edited or erased.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

function PhotoCaptureCard({
  role,
  label,
  description,
  slot,
  onSelect,
}: {
  role: EvidenceRole;
  label: string;
  description: string;
  slot: PhotoSlot;
  onSelect: (file: File | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-field-hairline bg-field-canopy p-4 flex flex-col justify-between space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-field-text">{label}</span>
          <span className="text-[10px] font-mono text-field-muted uppercase">{role}</span>
        </div>
        <p className="text-[11px] text-field-muted">{description}</p>
      </div>

      {slot.previewUrl ? (
        <div className="space-y-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-field-hairline bg-field-abyss">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.previewUrl}
              alt={`${role} preview`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-2 right-2 rounded-md bg-field-abyss/80 border border-field-hairline px-2.5 py-1 text-[11px] text-field-text hover:bg-field-abyss transition-colors"
            >
              Replace
            </button>
          </div>

          <div className="space-y-1 pt-1">
            <span className="text-[11px] text-field-muted block">Client-computed SHA-256:</span>
            {slot.isHashing ? (
              <span className="text-xs font-mono text-signal animate-pulse">Computing hash…</span>
            ) : slot.clientSha256 ? (
              <HashDisplay
                hash={slot.clientSha256}
                variant="truncated"
                theme="field"
                label="SHA-256"
              />
            ) : null}
            <span className="text-[10px] text-field-muted block italic">
              computed on device — server recomputes on intake
            </span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border border-dashed border-field-hairline hover:border-field-inert rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors space-y-2 bg-field-raised/40 hover:bg-field-raised"
        >
          <div className="size-10 rounded-full bg-field-raised border border-field-hairline flex items-center justify-center text-field-muted">
            <Camera className="size-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-field-text block">Capture or select photo</span>
            <span className="text-[11px] text-field-muted block">JPEG, PNG or WebP up to 5 MB</span>
          </div>
        </div>
      )}

      {slot.error && (
        <p className="text-xs text-fraud flex items-center gap-1.5">
          <AlertCircle className="size-3.5" />
          <span>{slot.error}</span>
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="hidden"
      />
    </div>
  );
}
