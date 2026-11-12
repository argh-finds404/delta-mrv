// What a file is, judged from its first bytes. The filename and the browser's Content-Type are
// convenience, never evidence: a .jpg extension on a PDF is the simplest upload attack there is
// (docs/13-FEATURE-SPEC.md A1). Isomorphic, so the submit page can warn early with the same rule.

export type EvidenceMime = "image/jpeg" | "image/png" | "image/webp";

/** What intake accepts. HEIC is listed in M5 but cannot be decoded by this build: see heicRefusal. */
export const ACCEPTED_EVIDENCE_TYPES: readonly EvidenceMime[] = ["image/jpeg", "image/png", "image/webp"];

export const EXTENSION: Record<EvidenceMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** 5 MB, the cap on every evidence original (docs/01-FEATURE-LOCK.md M5). */
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export const HEIC_REFUSAL =
  "HEIC photos are not supported yet. On an iPhone, set Camera > Formats to Most Compatible, or share the photo as a JPEG.";

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export function sniffImageType(b: Uint8Array): EvidenceMime | "image/heic" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp" && HEIC_BRANDS.has(ascii(b, 8, 4))) return "image/heic";
  return null;
}
