import type { OfflineBannerProps } from "./offline-banner";

export const offlineBannerFixtures: Record<string, OfflineBannerProps> = {
  offlineWithQueue: {
    isOffline: true,
    queuedCount: 2,
    isSyncing: false,
    theme: "field",
  },
  offlineZeroQueue: {
    isOffline: true,
    queuedCount: 0,
    isSyncing: false,
    theme: "field",
  },
  syncingQueue: {
    isOffline: false,
    queuedCount: 2,
    isSyncing: true,
    theme: "field",
  },
  paperOffline: {
    isOffline: true,
    queuedCount: 1,
    isSyncing: false,
    theme: "paper",
  },
  paperSyncing: {
    isOffline: false,
    queuedCount: 1,
    isSyncing: true,
    theme: "paper",
  },
};

