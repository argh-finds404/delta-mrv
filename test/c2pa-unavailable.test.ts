// When the reader's WebAssembly cannot be loaded (a deployment that did not ship the file), the
// check is skipped and logged: it never takes the other forensic checks down with it.
import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    readFileSync: (p: Parameters<typeof fs.readFileSync>[0], ...rest: unknown[]) => {
      if (String(p).endsWith(".wasm")) throw new Error("ENOENT: no such file, c2pa_bg.wasm");
      return (fs.readFileSync as (...a: unknown[]) => unknown)(p, ...rest);
    },
  };
});

describe("a missing C2PA reader", () => {
  it("reports unavailable instead of throwing, and logs why once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { readC2pa } = await import("../src/server/forensics/c2pa");
    expect(await readC2pa(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toEqual({ outcome: "unavailable" });
    expect(await readC2pa(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toEqual({ outcome: "unavailable" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]![0])).toMatch(/^C2PA reader unavailable: ENOENT/);
    log.mockRestore();
  });
});
