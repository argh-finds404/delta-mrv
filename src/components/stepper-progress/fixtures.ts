import type { StepperProgressProps, StepItem } from "./stepper-progress";

export const samplePipelineStepsInFlight: StepItem[] = [
  {
    id: "stage-1",
    label: "Stored and hashed",
    status: "done",
    value: "sha256 a3f2…b206",
  },
  {
    id: "stage-2",
    label: "Perceptual hash computed",
    status: "done",
    value: "dhash 64 bits",
  },
  {
    id: "stage-3",
    label: "Duplicate search",
    status: "done",
    value: "0 findings",
  },
  {
    id: "stage-4",
    label: "Metadata extracted",
    status: "done",
    value: "GPS present [89.2465, 21.9497]",
  },
  {
    id: "stage-5",
    label: "Boundary check",
    status: "running",
  },
  {
    id: "stage-6",
    label: "Change detection",
    status: "queued",
  },
  {
    id: "stage-7",
    label: "Advisory observation",
    status: "queued",
    isOptional: true,
  },
];

export const samplePipelineStepsCompleteWithDuplicate: StepItem[] = [
  {
    id: "stage-1",
    label: "Stored and hashed",
    status: "done",
    value: "sha256 7c8c…5b6d",
  },
  {
    id: "stage-2",
    label: "Perceptual hash computed",
    status: "done",
    value: "dhash 64 bits",
  },
  {
    id: "stage-3",
    label: "Duplicate search",
    status: "warning",
    value: "1 finding (Hamming dist: 4 ≤ 10)",
  },
  {
    id: "stage-4",
    label: "Metadata extracted",
    status: "done",
    value: "GPS present",
  },
  {
    id: "stage-5",
    label: "Boundary check",
    status: "done",
    value: "Within Sundarbans polygon",
  },
  {
    id: "stage-6",
    label: "Change detection",
    status: "done",
    value: "+18.4% canopy growth",
  },
  {
    id: "stage-7",
    label: "Advisory observation",
    status: "failed",
    isOptional: true,
    error: "AI unavailable (quota fallback)",
  },
];

export const stepperProgressFixtures: Record<string, StepperProgressProps> = {
  inFlight: {
    title: "Forensics Pipeline Progress",
    steps: samplePipelineStepsInFlight,
    elapsedSeconds: 4.8,
    theme: "field",
  },
  duplicateDetected: {
    title: "Forensics Pipeline Audit Completed",
    steps: samplePipelineStepsCompleteWithDuplicate,
    elapsedSeconds: 11.2,
    theme: "field",
  },
  paperInFlight: {
    title: "Independent Verification Pipeline",
    steps: samplePipelineStepsInFlight,
    elapsedSeconds: 3.5,
    theme: "paper",
  },
};

