import { describe, expect, it } from "vitest";
import { CEDAR_INLET, SITE, pointInPolygon } from "./site.ts";

describe("site zones", () => {
  it("contains a point in the Alder Harbor fuel pier and rejects the channel", () => {
    const ring = SITE.restricted_zones[0].polygon.coordinates;
    expect(pointInPolygon(-122.4113, 47.63, ring)).toBe(true);
    expect(pointInPolygon(-122.4, 47.62, ring)).toBe(false);
  });

  it("contains a point in the Cedar Inlet fuel dock", () => {
    const ring = CEDAR_INLET.restricted_zones[0].polygon.coordinates;
    expect(pointInPolygon(-122.4623, 47.2534, ring)).toBe(true);
    expect(pointInPolygon(-122.45, 47.24, ring)).toBe(false);
  });
});
