import "server-only";
import { blobStorage } from "./blob";
import { localDiskStorage } from "./local";
import type { StoragePort } from "./port";

// Which store holds evidence originals. The private blob store, always, in production. On a
// development machine with LOCAL_STORAGE_DIR set, that directory instead, so intake, forensics
// and the end-to-end test run with no external service.
const localDir = process.env.NODE_ENV === "production" ? undefined : process.env.LOCAL_STORAGE_DIR || undefined;

export const localStorage = localDir ? localDiskStorage(localDir) : null;

// resolved on each call, not at import: the blob adapter stays replaceable for as long as the process lives
const active = (): StoragePort => localStorage?.port ?? blobStorage;
export const evidenceStorage: StoragePort = {
  get: (key) => active().get(key),
  uploadToken: (key, limits) => active().uploadToken(key, limits),
  deletePrefix: (prefix) => active().deletePrefix(prefix),
};
