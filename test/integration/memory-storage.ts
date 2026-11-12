import type { StoragePort } from "../../src/server/storage/port";

/** The blob store as a Map, for tests: what a browser would have uploaded, under its key. */
export function memoryStorage() {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const tokens: { key: string; maxBytes: number; contentTypes: readonly string[] }[] = [];
  const port: StoragePort = {
    async get(key) {
      const bytes = files.get(key);
      return bytes ? { stream: new Blob([bytes]).stream(), size: bytes.length } : null;
    },
    async uploadToken(key, limits) {
      tokens.push({ key, ...limits });
      return `test-token:${key}`;
    },
    async deletePrefix(prefix) {
      let n = 0;
      for (const key of [...files.keys()]) if (key.startsWith(prefix) && files.delete(key)) n++;
      return n;
    },
  };
  return { port, files, tokens, put: (key: string, bytes: Uint8Array) => files.set(key, Uint8Array.from(bytes)) };
}
