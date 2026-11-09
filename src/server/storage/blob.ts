import "server-only";
import { get } from "@vercel/blob";
import { requireEnv } from "../../env";
import type { StoragePort } from "./port";

// The only module in src/ that imports @vercel/blob. The store is private: no blob has a
// public URL, and every read carries the server's token.
export const blobStorage: StoragePort = {
  async get(key) {
    const res = await get(key, { access: "private", token: requireEnv("BLOB_READ_WRITE_TOKEN") });
    return res?.statusCode === 200 ? { stream: res.stream, size: res.blob.size } : null;
  },
};
