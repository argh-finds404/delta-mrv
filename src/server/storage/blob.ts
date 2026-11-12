import "server-only";
import { del, get, list } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { requireEnv } from "../../env";
import { StorageUnavailable, type StoragePort } from "./port";

// The only module in src/ that imports @vercel/blob. The store is private: no blob has a
// public URL, and every read carries the server's token.
const token = () => {
  try {
    return requireEnv("BLOB_READ_WRITE_TOKEN");
  } catch (e) {
    throw new StorageUnavailable(e instanceof Error ? e.message : "BLOB_READ_WRITE_TOKEN is not set");
  }
};
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

export const blobStorage: StoragePort = {
  async get(key) {
    const res = await get(key, { access: "private", token: token(), useCache: false });
    return res?.statusCode === 200 ? { stream: res.stream, size: res.blob.size } : null;
  },

  uploadToken(key, limits) {
    return generateClientTokenFromReadWriteToken({
      token: token(),
      pathname: key,
      maximumSizeInBytes: limits.maxBytes,
      allowedContentTypes: [...limits.contentTypes],
      validUntil: Date.now() + UPLOAD_WINDOW_MS,
      addRandomSuffix: false,
      allowOverwrite: false, // an original, once stored, is never replaced
    });
  },

  async deletePrefix(prefix) {
    let removed = 0;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, token: token() });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url), { token: token() });
      removed += page.blobs.length;
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return removed;
  },
};
