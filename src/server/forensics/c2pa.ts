// Server-side C2PA reader (docs/10-FORENSICS.md, X9): loads @contentauth/c2pa-wasm once per process
// and hands its report to the pure verdict in src/lib/forensics/c2pa.ts.
import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initSync, WasmReader } from "@contentauth/c2pa-wasm";
import { C2PA_RULE_VERSION, c2paFinding, classifyReaderError, parseC2paManifestStore, type C2paFinding, type C2paReadResult } from "../../lib/forensics/c2pa";

export { C2PA_RULE_VERSION, c2paFinding, type C2paFinding, type C2paReadResult };

/**
 * The reader stays off the network. A photo's XMP can name any URL as its manifest's home (an
 * internal address included), and OCSP would make the verdict depend on a third party's answer on
 * the day: with both off, the verdict is a function of the bytes, and a replay agrees with the run.
 */
export const READER_CONTEXT = JSON.stringify({ verify: { remote_manifest_fetch: false, ocsp_fetch: false } });

// Traced into the functions that run the checks: next.config.ts, outputFileTracingIncludes.
const WASM_PATH = resolve(/* turbopackIgnore: true */ process.cwd(), "node_modules/@contentauth/c2pa-wasm/pkg/c2pa_bg.wasm");

let loaded: "not-yet" | "ready" | "failed" = "not-yet";

/** Loads the reader once. A server that cannot (the file was not deployed) skips the check, and says why once. */
function ensureReader(): boolean {
  if (loaded === "not-yet") {
    try {
      initSync({ module: readFileSync(/* turbopackIgnore: true */ WASM_PATH) });
      loaded = "ready";
    } catch (e) {
      loaded = "failed";
      console.error(`C2PA reader unavailable: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return loaded === "ready";
}

export async function readC2pa(bytes: Uint8Array, mime = "image/jpeg"): Promise<C2paReadResult> {
  if (!ensureReader()) return { outcome: "unavailable" };
  let reader: WasmReader;
  try {
    reader = await WasmReader.fromBytes(mime, bytes, READER_CONTEXT);
  } catch (e) {
    return classifyReaderError(e instanceof Error ? e.message : String(e));
  }
  try {
    return parseC2paManifestStore(reader.json());
  } finally {
    reader.free();
  }
}
