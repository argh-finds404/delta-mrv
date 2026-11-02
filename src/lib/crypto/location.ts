import canonicalize from "canonicalize";

// docs/02-ARCHITECTURE.md §4.3. A cross-runtime contract: the server commits to a
// location and a browser can recompute it from the exact polygon and the salt.
//
//   locationCommitment = SHA256("DELTA_LOC_V1:" + salt_hex + ":" + canonicalize(exactGeoJson))
//
// Do not change the prefix, the separator or the serialiser: every commitment already
// stored (and, from Stage 6, anchored) would stop verifying.
const PREFIX = "DELTA_LOC_V1:";

export async function locationCommitment(saltHex: string, exactGeoJson: unknown): Promise<string> {
  if (!/^[0-9a-f]+$/.test(saltHex)) throw new Error("salt must be lowercase hex");
  const canonical = canonicalize(exactGeoJson);
  if (canonical === undefined) throw new Error("geometry is not serialisable");

  const bytes = new TextEncoder().encode(`${PREFIX}${saltHex}:${canonical}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
