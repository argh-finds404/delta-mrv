import "server-only";

/**
 * Where evidence originals live (docs/13-FEATURE-SPEC.md A1). No provider type crosses this
 * line, so a test or a different store can stand in for the blob adapter.
 */
export interface StoragePort {
  /** The stored bytes under `key`, or null when nothing is stored there. */
  get(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>;
  /**
   * A short-lived token that lets a browser upload exactly one file, to exactly `key`, within
   * the limits. A convenience: the server still checks the stored bytes at finalize.
   */
  uploadToken(key: string, limits: { maxBytes: number; contentTypes: readonly string[] }): Promise<string>;
  /** Deletes everything stored under `prefix`; returns how many objects went. For abandoned drafts. */
  deletePrefix(prefix: string): Promise<number>;
}

/** The store is not configured on this server (no token): a setting to fix, not evidence loss. */
export class StorageUnavailable extends Error {}
