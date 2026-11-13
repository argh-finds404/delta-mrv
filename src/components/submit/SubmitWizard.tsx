"use client";

import * as React from "react";
import Link from "next/link";
import { put } from "@vercel/blob/client";
import exifr from "exifr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Database,
  Flame,
  HardDriveDownload,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { OfflineBanner } from "@/src/components/offline-banner/offline-banner";
import { StepperProgress, type StepItem } from "@/src/components/stepper-progress/stepper-progress";
import { activityColor } from "@/src/lib/activity";
import { ACTIVITY_LABEL } from "@/src/lib/format";
import { cn } from "@/src/lib/utils";
import {
  ADVERSARIAL_SCENARIOS,
  generateAdversarialPair,
  type AdversarialScenario,
} from "./adversarial-generator";
import {
  deleteOfflineDraft,
  fileToStored,
  listOfflineDrafts,
  saveOfflineDraft,
  storedToFile,
  type OfflineDraft,
} from "./offline-vault";

export interface SubmitWizardProps {
  projectId: string;
  projectTitle: string;
  activityType: string;
  supplementSubmissionId?: string;
  isDemoMode?: boolean;
}

type EvidenceRole = "BEFORE" | "AFTER" | "SUPPLEMENT";

interface PhotoSlot {
  file: File | null;
  previewUrl: string | null;
  clientSha256: string | null;
  isHashing: boolean;
  error: string | null;
  gps: { latitude: number; longitude: number } | null;
  cameraModel: string | null;
  dateTimeOriginal: string | null;
  exifChecked: boolean;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per doc 14 §6

/**
 * Sends one file to the path the server chose. A development server that keeps evidence on its
 * own disk hands out its own tokens ("local:") and takes the bytes itself; everywhere else the
 * browser uploads straight to the private blob store.
 */
async function uploadEvidence(pathname: string, file: File, token: string): Promise<void> {
  if (!token.startsWith("local:")) {
    await put(pathname, file, { access: "private", token });
    return;
  }
  const res = await fetch("/api/dev/storage", { method: "PUT", headers: { authorization: token, "x-pathname": pathname, "content-type": file.type || "image/jpeg" }, body: file });
  if (!res.ok) throw new Error("The photo could not be stored. Try again.");
}

// What happens to a submission, in the words of the person sending it.
const STEPS: StepItem[] = [
  { id: "hash", label: "Fingerprint on this device", status: "queued" },
  { id: "upload", label: "Upload to private storage", status: "queued" },
  { id: "forensics", label: "Automatic checks", status: "queued" },
  { id: "review", label: "Independent review", status: "queued" },
];

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
  supplementSubmissionId,
  isDemoMode = true,
}: SubmitWizardProps) {
  const isSupplement = Boolean(supplementSubmissionId);

  const [before, setBefore] = React.useState<PhotoSlot>({
    file: null,
    previewUrl: null,
    clientSha256: null,
    isHashing: false,
    error: null,
    gps: null,
    cameraModel: null,
    dateTimeOriginal: null,
    exifChecked: false,
  });

  const [after, setAfter] = React.useState<PhotoSlot>({
    file: null,
    previewUrl: null,
    clientSha256: null,
    isHashing: false,
    error: null,
    gps: null,
    cameraModel: null,
    dateTimeOriginal: null,
    exifChecked: false,
  });

  const [supplement, setSupplement] = React.useState<PhotoSlot>({
    file: null,
    previewUrl: null,
    clientSha256: null,
    isHashing: false,
    error: null,
    gps: null,
    cameraModel: null,
    dateTimeOriginal: null,
    exifChecked: false,
  });

  const [note, setNote] = React.useState("");
  const [deviceGps, setDeviceGps] = React.useState<{ lat: number; lon: number } | null>(null);
  const [isGettingGps, setIsGettingGps] = React.useState(false);
  const [gpsError, setGpsError] = React.useState<string | null>(null);

  // Offline Draft Vault (IndexedDB)
  const [offlineCount, setOfflineCount] = React.useState(0);
  const [savedDrafts, setSavedDrafts] = React.useState<OfflineDraft[]>([]);
  const [showVaultDrawer, setShowVaultDrawer] = React.useState(false);
  const [vaultFeedback, setVaultFeedback] = React.useState<string | null>(null);

  // Adversarial Simulation State
  const [simulatingScenario, setSimulatingScenario] = React.useState<string | null>(null);
  const [showSimulator, setShowSimulator] = React.useState(false);

  const isOnline = React.useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => (typeof navigator !== "undefined" ? navigator.onLine : true),
    () => true,
  );

  const refreshVault = React.useCallback(async () => {
    try {
      const drafts = await listOfflineDrafts();
      setSavedDrafts(drafts);
      setOfflineCount(drafts.length);
    } catch {
      // IndexedDB unready
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    void listOfflineDrafts()
      .then((drafts) => {
        if (!active) return;
        setSavedDrafts(drafts);
        setOfflineCount(drafts.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Submission pipeline state
  const [submissionState, setSubmissionState] = React.useState<"idle" | "pipeline">("idle");
  const [steps, setSteps] = React.useState<StepItem[]>(STEPS);
  const setStep = (id: string, patch: Partial<StepItem>) => setSteps((s) => s.map((step) => (step.id === id ? { ...step, ...patch } : step)));

  /**
   * Follows the checks after finalize or a supplement, by reading the submission's findings.
   * Never marks unfinished work as done: if the checks are still running when we stop
   * polling, the step says so and points at where the results will appear.
   */
  const followChecks = async (submissionId: string) => {
    setStep("upload", { status: "done", value: "Stored privately. The server fingerprinted the stored file itself." });
    setStep("forensics", { status: "running", value: "Checking for reused photos, capture time and position…" });
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/submissions/${submissionId}/findings`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) continue;
      const data = (await res.json()) as { submission: { status: string }; findings: { severity: string; reason: string }[] };
      if (data.submission.status !== "IN_REVIEW" && data.submission.status !== "ESCALATED") continue;
      const count = (sev: string) => data.findings.filter((f) => f.severity === sev).length;
      const [high, medium, low] = [count("HIGH"), count("MEDIUM"), count("LOW")];
      const parts = [high && `${high} high`, medium && `${medium} medium`, low && `${low} low`].filter(Boolean);
      setStep("forensics", {
        status: high || medium ? "warning" : "done",
        value: parts.length ? `${data.findings.length} findings: ${parts.join(", ")}. Each has a reason a reviewer will read.` : "Nothing to flag.",
      });
      setStep("review", { status: "queued", value: "Waiting for two reviewers from an independent organisation." });
      return;
    }
    setStep("forensics", { status: "running", value: "Still running. The findings will appear on the project page." });
  };

  const handleFileSelect = async (role: EvidenceRole, file: File | null) => {
    const updater =
      role === "BEFORE" ? setBefore : role === "AFTER" ? setAfter : setSupplement;

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
      gps: null,
      cameraModel: null,
      dateTimeOriginal: null,
      exifChecked: false,
    });

    try {
      // 1. Client-side SHA-256 computation
      const hash = await computeSha256(file);

      // 2. Client-side EXIF inspection via exifr (Feature 1 & 5)
      let parsedGps: { latitude: number; longitude: number } | null = null;
      let cameraModel: string | null = null;
      let dateTimeOriginal: string | null = null;

      try {
        const rawGps = (await exifr.gps(file).catch(() => null)) as {
          latitude?: number;
          longitude?: number;
        } | null;
        if (
          rawGps &&
          typeof rawGps.latitude === "number" &&
          typeof rawGps.longitude === "number"
        ) {
          parsedGps = { latitude: rawGps.latitude, longitude: rawGps.longitude };
        }

        const meta = (await exifr
          .parse(file, ["Make", "Model", "DateTimeOriginal"])
          .catch(() => null)) as {
          Make?: string;
          Model?: string;
          DateTimeOriginal?: string | Date;
        } | null;

        if (meta) {
          if (meta.Make || meta.Model) {
            cameraModel = [meta.Make, meta.Model].filter(Boolean).join(" ").trim();
          }
          if (meta.DateTimeOriginal) {
            dateTimeOriginal = new Date(meta.DateTimeOriginal).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
          }
        }
      } catch {
        // EXIF stripped
      }

      updater((prev) => ({
        ...prev,
        clientSha256: hash,
        isHashing: false,
        gps: parsedGps,
        cameraModel,
        dateTimeOriginal,
        exifChecked: true,
      }));
    } catch {
      updater((prev) => ({
        ...prev,
        isHashing: false,
        error: "Failed to compute client SHA-256 checksum",
        exifChecked: true,
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

  // Offline Save to Local Field Vault
  const handleSaveDraftOffline = async () => {
    if (!before.file || !before.clientSha256 || !after.file || !after.clientSha256) {
      setVaultFeedback("Select both BEFORE and AFTER photographs before saving to Field Vault.");
      return;
    }

    try {
      const beforeStored = await fileToStored(before.file, before.clientSha256);
      const afterStored = await fileToStored(after.file, after.clientSha256);

      await saveOfflineDraft({
        projectId,
        projectTitle,
        activityType,
        note,
        deviceGps,
        beforeFile: beforeStored,
        afterFile: afterStored,
      });

      await refreshVault();
      setVaultFeedback("Draft saved locally in Field Vault. It can be submitted once online.");
      setTimeout(() => setVaultFeedback(null), 5000);
    } catch {
      setVaultFeedback("Could not save to local storage.");
    }
  };

  const handleRestoreDraft = async (draft: OfflineDraft) => {
    const bFile = storedToFile(draft.beforeFile);
    const aFile = storedToFile(draft.afterFile);
    setNote(draft.note);
    setDeviceGps(draft.deviceGps);

    await Promise.all([
      handleFileSelect("BEFORE", bFile),
      handleFileSelect("AFTER", aFile),
    ]);
    setShowVaultDrawer(false);
  };

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteOfflineDraft(id);
    await refreshVault();
  };

  // Adversarial Simulator handler
  const handleLoadScenario = async (scenarioId: AdversarialScenario["id"]) => {
    setSimulatingScenario(scenarioId);
    try {
      const data = await generateAdversarialPair(scenarioId);
      setNote(data.note);
      setDeviceGps(data.deviceGps);

      await Promise.all([
        handleFileSelect("BEFORE", data.beforeFile),
        handleFileSelect("AFTER", data.afterFile),
      ]);
    } catch (err) {
      console.error("Adversarial generator error:", err);
    } finally {
      setSimulatingScenario(null);
    }
  };

  const canSubmitPair =
    Boolean(before.file && before.clientSha256) &&
    Boolean(after.file && after.clientSha256) &&
    !before.isHashing &&
    !after.isHashing;

  const canSubmitSupplement =
    Boolean(supplement.file && supplement.clientSha256) && !supplement.isHashing;

  const canSubmit = isSupplement ? canSubmitSupplement : canSubmitPair;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmissionState("pipeline");
    setSteps(
      STEPS.map((step) =>
        step.id === "hash"
          ? { ...step, status: "done", value: "Computed here. Unverified: the server recomputes it from the stored file." }
          : step.id === "upload"
            ? { ...step, status: "running", value: "Requesting an upload link…" }
            : step,
      ),
    );

    if (!isOnline) {
      setSteps((s) =>
        s.map((step) =>
          step.id === "upload"
            ? { ...step, status: "failed", value: "This device is offline. The pair is saved on this device; send it when you are back online." }
            : step.id === "hash"
              ? step
              : { ...step, status: "skipped" },
        ),
      );
      // Automatically commit to offline vault
      if (!isSupplement && before.file && before.clientSha256 && after.file && after.clientSha256) {
        handleSaveDraftOffline();
      }
      return;
    }

    try {
      // -------------------------------------------------------------
      // Flow A: Remediation / Supplement Submission
      // -------------------------------------------------------------
      if (isSupplement && supplementSubmissionId) {
        const file = supplement.file!;
        const clientSha256 = supplement.clientSha256!;

        // 1. Issue scoped upload token for SUPPLEMENT
        const tokRes = await fetch(`/api/submissions/${supplementSubmissionId}/upload-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "SUPPLEMENT", contentType: file.type || "image/jpeg" }),
        });
        if (!tokRes.ok) {
          const err = (await tokRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error || "Failed to obtain upload token for supplement");
        }
        const tok = (await tokRes.json()) as { pathname: string; clientToken: string };

        // 2. Direct upload to private blob store
        setStep("upload", { value: "Uploading the photo…" });
        await uploadEvidence(tok.pathname, file, tok.clientToken);

        // 3. Post supplement: a new round, and a forensics pass for it
        const suppRes = await fetch(`/api/submissions/${supplementSubmissionId}/supplement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathname: tok.pathname, clientSha256 }),
        });
        if (!suppRes.ok) {
          const err = (await suppRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error || `Supplement submission failed (${suppRes.status})`);
        }

        await followChecks(supplementSubmissionId);
        return;
      }

      // -------------------------------------------------------------
      // Flow B: Standard Before/After Pair Intake
      // -------------------------------------------------------------
      const bFile = before.file!;
      const aFile = after.file!;

      // 1. Create draft
      const draftRes = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!draftRes.ok) {
        const err = (await draftRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || `Failed to create draft (${draftRes.status})`);
      }
      const draft = (await draftRes.json()) as { id: string };

      // 2. Issue scoped upload tokens
      setStep("upload", { value: "Requesting upload links…" });
      const [beforeTokRes, afterTokRes] = await Promise.all([
        fetch(`/api/submissions/${draft.id}/upload-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "BEFORE", contentType: bFile.type || "image/jpeg" }),
        }),
        fetch(`/api/submissions/${draft.id}/upload-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "AFTER", contentType: aFile.type || "image/jpeg" }),
        }),
      ]);

      if (!beforeTokRes.ok || !afterTokRes.ok) {
        const err = (await (beforeTokRes.ok ? afterTokRes : beforeTokRes).json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to issue upload token");
      }
      const beforeTok = (await beforeTokRes.json()) as { pathname: string; clientToken: string };
      const afterTok = (await afterTokRes.json()) as { pathname: string; clientToken: string };

      // 3. Direct upload to private blob store
      setStep("upload", { value: "Uploading both photos…" });
      await Promise.all([
        uploadEvidence(beforeTok.pathname, bFile, beforeTok.clientToken),
        uploadEvidence(afterTok.pathname, aFile, afterTok.clientToken),
      ]);

      // 4. Finalize submission in database transaction
      setStep("upload", { value: "Recording the files…" });
      const finRes = await fetch(`/api/submissions/${draft.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            { role: "BEFORE", pathname: beforeTok.pathname, clientSha256: before.clientSha256 },
            { role: "AFTER", pathname: afterTok.pathname, clientSha256: after.clientSha256 },
          ],
        }),
      });
      if (!finRes.ok) {
        const err = (await finRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || `Intake finalization failed (${finRes.status})`);
      }

      // 5. Follow the checks the server queued
      await followChecks(draft.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Evidence transmission failed";
      setSteps((s) =>
        s.map((step) =>
          step.id === "upload"
            ? { ...step, status: "failed", value: message }
            : step.id === "hash"
              ? step
              : { ...step, status: "skipped" },
        ),
      );
    }
  };

  const handleReset = () => {
    setBefore({
      file: null,
      previewUrl: null,
      clientSha256: null,
      isHashing: false,
      error: null,
      gps: null,
      cameraModel: null,
      dateTimeOriginal: null,
      exifChecked: false,
    });
    setAfter({
      file: null,
      previewUrl: null,
      clientSha256: null,
      isHashing: false,
      error: null,
      gps: null,
      cameraModel: null,
      dateTimeOriginal: null,
      exifChecked: false,
    });
    setSupplement({
      file: null,
      previewUrl: null,
      clientSha256: null,
      isHashing: false,
      error: null,
      gps: null,
      cameraModel: null,
      dateTimeOriginal: null,
      exifChecked: false,
    });
    setNote("");
    setDeviceGps(null);
    setSubmissionState("idle");
    setSteps(STEPS);
  };

  return (
    <div className="space-y-6">
      <OfflineBanner
        theme="field"
        isOffline={!isOnline}
        queuedCount={offlineCount}
      />

      {/* 1. Context Header */}
      <header className="space-y-3 pb-2">
        <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-[14px] text-field-muted transition-colors hover:text-field-text">
          <ArrowLeft className="size-4" />
          <span>{projectTitle}</span>
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <h1 className="font-serif text-[36px] leading-[1.08] tracking-[-0.02em] text-field-text sm:text-[42px]">
            {isSupplement ? "Add more proof" : "Submit evidence"}
          </h1>
          <span
            className="rounded-full px-2.5 py-0.5 text-[13px] font-medium"
            style={{ color: activityColor(activityType), background: `color-mix(in srgb, ${activityColor(activityType)} 12%, white)` }}
          >
            {ACTIVITY_LABEL[activityType as keyof typeof ACTIVITY_LABEL] ?? activityType}
          </span>
        </div>

        {isSupplement ? (
          <div className="rounded-lg border border-review/30 bg-review/10 p-3 text-xs text-review space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Remediation Round for Submission {supplementSubmissionId}</span>
            </div>
            <p className="text-field-muted leading-relaxed">
              An independent reviewer requested additional photographic proof or a clearer plot angle.
              Submitting this photo advances the submission to the next review round.
            </p>
          </div>
        ) : (
          <p className="max-w-[60ch] text-[16px] leading-[1.55] text-field-muted">
            A before and an after photo of the same spot. Each is fingerprinted on this device, uploaded straight to private storage, and checked for reuse, capture time and position.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 text-xs text-field-muted">

          {/* Local Vault Badge */}
          {offlineCount > 0 && (
            <button
              type="button"
              onClick={() => setShowVaultDrawer((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded border border-field-hairline bg-field-canopy px-2 py-1 text-[11px] text-field-text hover:bg-field-raised transition-colors"
            >
              <Database className="size-3 text-signal" />
              <span>{offlineCount} Pending Draft{offlineCount === 1 ? "" : "s"} in Field Vault</span>
            </button>
          )}
        </div>
      </header>

      {/* Local Vault Drawer */}
      {showVaultDrawer && savedDrafts.length > 0 && (
        <div className="rounded-xl border border-field-hairline bg-field-canopy p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-field-text flex items-center gap-2">
              <Database className="size-4 text-signal" />
              <span>Offline Field Vault (IndexedDB)</span>
            </span>
            <span className="text-[11px] font-mono text-field-muted">
              Preserved across app restarts
            </span>
          </div>
          <div className="space-y-2">
            {savedDrafts.map((d) => (
              <div
                key={d.id}
                onClick={() => handleRestoreDraft(d)}
                className="flex items-center justify-between rounded-lg border border-field-hairline bg-field-raised p-2.5 text-xs cursor-pointer hover:border-field-muted transition-colors"
              >
                <div>
                  <span className="font-medium text-field-text block">{d.projectTitle}</span>
                  <span className="text-[11px] text-field-muted font-mono">
                    {new Date(d.createdAt).toLocaleString()} · {d.beforeFile.name} & {d.afterFile.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-signal font-mono">
                    <HardDriveDownload className="size-3" />
                    Restore
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteDraft(d.id, e)}
                    className="p-1 text-field-inert hover:text-fraud transition-colors"
                    title="Delete Draft"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adversarial Fraud Simulator Bar (Feature 8) */}
      {isDemoMode && !isSupplement && submissionState === "idle" && (
        <div className="rounded-xl border border-signal/20 bg-field-canopy/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-signal" />
              <span className="text-[14px] font-medium text-field-text">
                Try a test case (demo database only)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSimulator((v) => !v)}
              className="text-[11px] font-mono text-field-muted hover:text-field-text transition-colors"
            >
              {showSimulator ? "Hide Scenarios" : "Show Scenarios"}
            </button>
          </div>

          <p className="text-[11px] text-field-muted leading-relaxed">
            Fills the form with synthetic images drawn in this browser, not real photographs, to see how the
            checks respond to a reused photo or a position outside the site.
          </p>

          {showSimulator && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {ADVERSARIAL_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  disabled={Boolean(simulatingScenario)}
                  onClick={() => handleLoadScenario(sc.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all duration-150 flex flex-col justify-between space-y-2",
                    sc.id === "LEGITIMATE_MANGROVE"
                      ? "border-verified/30 bg-verified/5 hover:border-verified/70"
                      : sc.id === "CROSS_PROJECT_DUPLICATE"
                        ? "border-review/30 bg-review/5 hover:border-review/70"
                        : "border-fraud/30 bg-fraud/5 hover:border-fraud/70",
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-current text-field-text">
                        {sc.badge}
                      </span>
                      {sc.id === "LEGITIMATE_MANGROVE" ? (
                        <CheckCircle2 className="size-3.5 text-verified" />
                      ) : sc.id === "CROSS_PROJECT_DUPLICATE" ? (
                        <Flame className="size-3.5 text-review" />
                      ) : (
                        <ShieldAlert className="size-3.5 text-fraud" />
                      )}
                    </div>
                    <span className="text-xs font-medium text-field-text block leading-snug">
                      {sc.title}
                    </span>
                    <p className="text-[10px] text-field-muted leading-relaxed line-clamp-3">
                      {sc.description}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-signal">
                    {simulatingScenario === sc.id ? "Synthesizing JPEG bytes…" : "→ Inject Test Case"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Pipeline Execution / Status View */}
      {submissionState === "pipeline" ? (
        <div className="rounded-xl border border-field-hairline bg-field-canopy p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-field-text flex items-center gap-2">
              <AlertCircle className="size-4 text-signal" />
              <span>What is happening to this submission</span>
            </h2>
            <p className="text-xs text-field-muted">
              The photos go straight to private storage. The checks report signals with reasons; they never approve or reject.
            </p>
          </div>

          <StepperProgress title="Submission progress" steps={steps} theme="field" />

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
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-4 text-xs font-medium text-field-abyss hover:bg-[#14543D] transition-colors"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        /* 4. Active Submit Form */
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Pair Upload Cards OR Supplement Card */}
          {isSupplement ? (
            <PhotoCaptureCard
              role="SUPPLEMENT"
              label="Supplementary Photograph"
              description="Clear vantage point addressing reviewer remediation grounds"
              slot={supplement}
              onSelect={(file) => handleFileSelect("SUPPLEMENT", file)}
            />
          ) : (
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
          )}

          {/* Optional Note */}
          <div className="rounded-xl border border-field-hairline bg-field-canopy p-4 space-y-2">
            <label htmlFor="submit-note" className="block text-xs font-medium text-field-text">
              {isSupplement ? "Remediation Notes" : "Field Observations"}{" "}
              <span className="text-field-muted font-normal">(Optional)</span>
            </label>
            <p className="text-[11px] text-review">Kept on this device only: Delta does not store notes yet.</p>
            <textarea
              id="submit-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isSupplement
                  ? "e.g. Captured with compass bearing 120° showing perimeter boundary marker stake."
                  : "e.g. Tidal mudflat stabilized; 350 Rhizophora saplings planted in 2m grid."
              }
              className="w-full rounded-lg border border-field-hairline bg-field-raised p-3 text-xs text-field-text placeholder:text-field-inert focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>

          {/* Optional Device Location */}
          <div className="rounded-xl border border-field-hairline bg-field-canopy p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-field-text block">Device Geolocation</span>
                <span className="text-[11px] text-field-muted">
                  A <span className="text-review font-semibold">weak signal</span>, and kept on this device only: Delta does not store it yet. The server checks the position inside the photo.
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

          {/* Submission Gate & Actions */}
          <div className="space-y-3 border-t border-field-hairline pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-field-muted">
                {canSubmit ? (
                  <span className="text-verified flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    <span>Evidence hashed and prepared for intake</span>
                  </span>
                ) : (
                  <span>
                    {isSupplement
                      ? "Select supplementary photograph to enable submission"
                      : "Select both BEFORE and AFTER photographs to enable submission"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isSupplement && canSubmitPair && (
                  <button
                    type="button"
                    onClick={handleSaveDraftOffline}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-field-hairline bg-field-raised px-4 text-xs font-medium text-field-text hover:bg-field-canopy transition-colors"
                  >
                    <Database className="size-3.5 text-signal" />
                    <span>Save to Field Vault</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-signal",
                    canSubmit
                      ? "bg-signal text-field-abyss hover:bg-[#14543D]"
                      : "bg-field-raised text-field-inert border border-field-hairline cursor-not-allowed",
                  )}
                >
                  <span>
                    {isSupplement ? "Submit Supplementary Proof" : "Submit for Independent Review"}
                  </span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>

            {vaultFeedback && (
              <p className="text-xs text-signal font-mono flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span>{vaultFeedback}</span>
              </p>
            )}

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

          <div className="space-y-2 pt-1">
            {/* 1. Client SHA-256 */}
            <div className="space-y-1">
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
            </div>

            {/* 2. Client-Side EXIF Pre-Flight Inspection (Feature 1 & 5) */}
            {slot.exifChecked && (
              <div className="space-y-1.5 pt-1 border-t border-field-hairline/60">
                {slot.gps ? (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--verified)_35%,transparent)] bg-[color-mix(in_srgb,var(--verified)_10%,transparent)] px-2.5 py-1.5 text-[11px] font-mono text-verified">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="tabular-nums">
                      {slot.gps.latitude.toFixed(5)}° N, {slot.gps.longitude.toFixed(5)}° E
                    </span>
                    <span className="text-[10px] text-field-muted uppercase font-sans font-medium">
                      (Embedded EXIF)
                    </span>
                  </div>
                ) : (
                  <div className="rounded-md border border-[color-mix(in_srgb,var(--review)_35%,transparent)] bg-[color-mix(in_srgb,var(--review)_10%,transparent)] px-2.5 py-1.5 text-[11px] text-review flex items-start gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                      <strong>No embedded GPS detected</strong> — if shared via WhatsApp, Telegram, or social media, metadata was stripped. Camera original recommended.
                    </span>
                  </div>
                )}

                {(slot.cameraModel || slot.dateTimeOriginal) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-field-muted">
                    {slot.cameraModel && (
                      <span className="rounded bg-field-raised px-1.5 py-0.5 border border-field-hairline">
                        {slot.cameraModel}
                      </span>
                    )}
                    {slot.dateTimeOriginal && (
                      <span className="rounded bg-field-raised px-1.5 py-0.5 border border-field-hairline">
                        {slot.dateTimeOriginal}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <span className="text-[10px] text-field-muted block italic">
              computed on device — server recomputes on intake
            </span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={`Choose the ${role.toLowerCase()} photo`}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal border border-dashed border-field-hairline hover:border-field-inert rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors space-y-2 bg-field-raised/40 hover:bg-field-raised"
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
