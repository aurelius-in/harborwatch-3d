import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseEnvelope,
  parseTrackUpdate,
  SCHEMA,
} from "../src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(root, "fixtures", name), "utf8"));
}

describe("TrackUpdate contract", () => {
  it("accepts the golden vessel fixture", () => {
    const envelope = parseEnvelope(load("track-update.json"), parseTrackUpdate);
    expect(envelope.schema).toBe(SCHEMA.track);
    expect(envelope.payload.track_id).toBe("TRK-0027");
    expect(envelope.payload.object_type).toBe("vessel");
    expect(envelope.payload.sensor_id).toBe("LIDAR-03");
    expect(envelope.payload.confidence).toBeGreaterThan(0.5);
  });

  it("rejects a renamed speed field", () => {
    const broken = load("track-update.json") as {
      payload: Record<string, unknown>;
    };
    delete broken.payload.speed_mps;
    broken.payload.speed = 4.2;
    expect(() => parseEnvelope(broken, parseTrackUpdate)).toThrow(/speed_mps/);
  });

  it("rejects confidence outside 0 to 1", () => {
    const broken = load("track-update.json") as {
      payload: { confidence: number };
    };
    broken.payload.confidence = 1.4;
    expect(() => parseEnvelope(broken, parseTrackUpdate)).toThrow(/confidence/);
  });
});
