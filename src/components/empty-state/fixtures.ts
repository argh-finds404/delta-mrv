import type { EmptyStateProps } from "./empty-state";

export const emptyStateFixtures: Record<string, EmptyStateProps> = {
  labNoAssignments: {
    title: "Your review queue",
    reason:
      "Your organisation is not assigned to any projects yet. A platform administrator assigns verifier organisations to the projects they audit.",
    action: {
      label: "Contact support",
    },
    theme: "field",
  },
  labQueueClear: {
    title: "Queue clear",
    reason:
      "Nothing is awaiting your review. New submissions appear here automatically once forensic processing completes.",
    lastChecked: "Last reviewed 14 minutes ago.",
    theme: "field",
  },
  labFiltered: {
    title: "No submissions match these filters",
    reason:
      "23 submissions are in your queue. None are High severity.",
    unfilteredCount: 23,
    action: {
      label: "Clear filters",
    },
    theme: "field",
  },
  dashboardNoProjects: {
    title: "No projects yet",
    reason:
      "A project defines a restoration site, its boundary, and what you are claiming. Evidence is submitted against a project.",
    action: {
      label: "Create your first project",
    },
    theme: "field",
  },
  projectNoSubmissions: {
    title: "No evidence submitted yet",
    reason:
      "Evidence is a before and after photograph pair. Once submitted, it runs through forensic checks and then independent review.",
    action: {
      label: "Submit evidence",
    },
    theme: "field",
  },
  atlasNoProjects: {
    title: "No projects in this area",
    reason:
      "Delta currently has projects in the Sundarbans, Sylhet, Dhaka and Cox's Bazar.",
    action: {
      label: "Reset view",
    },
    theme: "field",
  },
  adminQueueHealthy: {
    title: "Queue healthy",
    reason: "No pending, failed or stuck jobs.",
    lastChecked: "Last drained 4 minutes ago.",
    theme: "field",
  },
  findingsNone: {
    title: "No findings",
    reason:
      "All seven deterministic checks completed and none produced a finding. This submission still requires independent review.",
    honestNote: "Clean automated checks do not constitute approval.",
    theme: "field",
  },
  paperQueueClear: {
    title: "Dossier audit complete",
    reason:
      "All evidentiary milestones have been validated and anchored on Base Sepolia.",
    lastChecked: "Verified against Block #18,241,092",
    theme: "paper",
  },
};

