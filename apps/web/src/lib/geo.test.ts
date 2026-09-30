import { describe, expect, it } from "vitest";
import { lerp, lerpRadians } from "./geo";

describe("interpolation helpers", () => {
  it("lerps linearly", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it("lerps angles across the wrap", () => {
    expect(lerpRadians(0, Math.PI, 0.5)).toBeCloseTo(Math.PI / 2);
  });
});
