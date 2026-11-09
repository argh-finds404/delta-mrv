import { describe, expect, it } from "vitest";
import { formatClaim, formatLatLon } from "../src/lib/format";

describe("formatLatLon", () => {
  it("puts latitude first and names each hemisphere", () => {
    expect(formatLatLon([89.325, 22.375])).toBe("22.3750° N, 89.3250° E");
    expect(formatLatLon([-122.27, -37.81], 2)).toBe("37.81° S, 122.27° W");
  });
});

describe("formatClaim", () => {
  it("groups thousands, keeps decimals and the unit, and is null without a claim", () => {
    expect(formatClaim("12000", "saplings")).toBe("12,000 saplings");
    expect(formatClaim("3.2", "km")).toBe("3.2 km");
    expect(formatClaim("45", null)).toBe("45");
    expect(formatClaim(null, "hectares")).toBeNull();
  });
});
