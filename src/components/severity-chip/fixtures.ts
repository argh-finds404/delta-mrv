import type { SeverityChipProps } from "./severity-chip";

export const severityChipFixtures: Record<string, SeverityChipProps> = {
  infoField: {
    severity: "info",
    theme: "field",
  },
  lowField: {
    severity: "low",
    theme: "field",
  },
  mediumField: {
    severity: "medium",
    theme: "field",
  },
  highField: {
    severity: "high",
    theme: "field",
  },
  mediumWithCount: {
    severity: "medium",
    count: 3,
    label: "Duplicate suspect",
    theme: "field",
  },
  highWithCount: {
    severity: "high",
    count: 1,
    label: "Tampered EXIF",
    theme: "field",
  },
  infoPaper: {
    severity: "info",
    theme: "paper",
  },
  mediumPaper: {
    severity: "medium",
    theme: "paper",
  },
  highPaper: {
    severity: "high",
    theme: "paper",
    count: 2,
  },
};

