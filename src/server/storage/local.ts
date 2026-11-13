import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { env } from "../../env";
import type { StoragePort } from "./port";

// Evidence originals on this machine's disk, behind the same port as the blob store. For local
// development and the end-to-end test only: it is chosen in ./index.ts when LOCAL_STORAGE_DIR
// is set, and never in a production build. Uploads arrive through PUT /api/dev/storage with a
// token this module signed, scoped like the blob store's: one path, a size, a type list, ten minutes.

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const PREFIX = "local:";

type Grant = { key: string; exp: number; maxBytes: number; contentTypes: string[] };

const sign = (payload: string) => createHmac("sha256", env.BETTER_AUTH_SECRET).update(`delta/local-storage/v1/${payload}`).digest("base64url");

export function localDiskStorage(dir: string) {
  const root = resolve(dir);
  /** The file a key names, or a refusal: a key never leaves the storage directory. */
  const fileOf = (key: string) => {
    const file = resolve(root, key);
    if (!file.startsWith(root + sep)) throw new Error("storage key escapes the storage directory");
    return file;
  };

  const port: StoragePort = {
    async get(key) {
      const file = fileOf(key);
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) return null;
      return { stream: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>, size: info.size };
    },

    async uploadToken(key, limits) {
      fileOf(key);
      const grant: Grant = { key, exp: Date.now() + UPLOAD_WINDOW_MS, maxBytes: limits.maxBytes, contentTypes: [...limits.contentTypes] };
      const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
      return `${PREFIX}${payload}.${sign(payload)}`;
    },

    async deletePrefix(prefix) {
      const target = fileOf(prefix);
      const entries = await readdir(target, { recursive: true, withFileTypes: true }).catch(() => []);
      await rm(target, { recursive: true, force: true });
      return entries.filter((e) => e.isFile()).length;
    },
  };

  /**
   * Stores one upload if the token grants exactly it. False for anything else: a bad or
   * expired token, another path, too many bytes, a type outside the list, or a path already
   * written (an original, once stored, is never replaced).
   */
  async function accept(token: string, key: string, contentType: string, bytes: Uint8Array): Promise<boolean> {
    if (!token.startsWith(PREFIX)) return false;
    const [payload, signature] = token.slice(PREFIX.length).split(".");
    if (!payload || !signature) return false;
    const [given, expected] = [Buffer.from(signature), Buffer.from(sign(payload))];
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString()) as Grant;
    if (grant.key !== key || grant.exp < Date.now() || bytes.length > grant.maxBytes || !grant.contentTypes.includes(contentType)) return false;
    const file = fileOf(key);
    await mkdir(dirname(file), { recursive: true });
    return writeFile(file, bytes, { flag: "wx" }).then(
      () => true,
      () => false,
    );
  }

  return { port, accept };
}
