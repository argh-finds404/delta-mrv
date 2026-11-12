import { describe, expect, it } from "vitest";
import { sniffImageType } from "../src/lib/forensics/mime";

const bytes = (...xs: (number | string)[]) =>
  Uint8Array.from(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("sniffImageType: judged by the bytes, never the name", () => {
  it("recognises JPEG, PNG and WebP signatures", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
    expect(sniffImageType(bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 "))).toBe("image/webp");
  });

  it("names HEIC so it can be refused with a reason, and treats AVIF as unknown", () => {
    expect(sniffImageType(bytes(0, 0, 0, 0x18, "ftypheic", 0, 0, 0, 0))).toBe("image/heic");
    expect(sniffImageType(bytes(0, 0, 0, 0x18, "ftypmif1", 0, 0, 0, 0))).toBe("image/heic");
    expect(sniffImageType(bytes(0, 0, 0, 0x18, "ftypavif", 0, 0, 0, 0))).toBeNull();
  });

  it("rejects everything else, including a PDF and a RIFF that is not WebP", () => {
    expect(sniffImageType(bytes("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(bytes("RIFF", 0x24, 0, 0, 0, "WAVEfmt "))).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull(); // too short to be sure
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});
