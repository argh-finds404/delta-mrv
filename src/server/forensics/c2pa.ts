// Server-side C2PA JUMBF reader (docs/10-FORENSICS.md, X9): loads @contentauth/c2pa-wasm once in
// Node and delegates manifest store parsing to the isomorphic src/lib/forensics/c2pa.ts module.
import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initSync, WasmReader } from "@contentauth/c2pa-wasm";
import {
  C2PA_RULE_VERSION,
  c2paFinding,
  type C2paFinding,
  type C2paReadResult,
  parseC2paManifestStore,
} from "../../lib/forensics/c2pa";

export { C2PA_RULE_VERSION, c2paFinding, type C2paFinding, type C2paReadResult };

let initialised = false;

function ensureWasm(): void {
  if (initialised) return;
  const wasmPath = resolve(
    /* turbopackIgnore: true */ process.cwd(),
    "node_modules/@contentauth/c2pa-wasm/pkg/c2pa_bg.wasm",
  );
  initSync({ module: readFileSync(/* turbopackIgnore: true */ wasmPath) });
  initialised = true;
}

export async function readC2pa(bytes: Uint8Array, mime = "image/jpeg"): Promise<C2paReadResult> {
  ensureWasm();
  let reader: WasmReader;
  try {
    reader = await WasmReader.fromBytes(mime, bytes);
  } catch {
    return { outcome: "absent" };
  }
  let rawJson: string;
  try {
    rawJson = reader.json();
  } finally {
    reader.free();
  }
  return parseC2paManifestStore(rawJson);
}
