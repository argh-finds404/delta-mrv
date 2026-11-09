import "server-only";

/**
 * Where evidence originals live (docs/13-FEATURE-SPEC.md A1). No provider type crosses
 * this line, so a test or a different store can stand in for the blob adapter.
 */
export interface StoragePort {
  /** The stored bytes under `key`, or null when nothing is stored there. */
  get(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>;
}
