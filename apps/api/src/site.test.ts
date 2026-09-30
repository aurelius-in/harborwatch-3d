import { describe, expect, it } from "vitest";
import { SITE, pointInPolygon } from "./site.ts";

describe("Alder Harbor zones", () => {
  it("contains a point in the fuel pier and rejects the channel", () => {
    const ring = SITE.restricted_zones[0].polygon.coordinates;
    expect(pointInPolygon(-122.4113, 47.63, ring)).toBe(true);
    expect(pointInPolygon(-122.4, 47.62, ring)).toBe(false);
  });
});
