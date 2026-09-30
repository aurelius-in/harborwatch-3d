import { describe, expect, it } from "vitest";
import { SiteBoard } from "./board.ts";

function track(id: string, lastSeen = new Date().toISOString()) {
  return {
    track_id: id,
    object_type: "vessel" as const,
    latitude: 47.62,
    longitude: -122.41,
    altitude: 0,
    speed_mps: 3,
    heading: 90,
    confidence: 0.9,
    sensor_id: "LIDAR-01",
    timestamp: lastSeen,
    last_seen: lastSeen,
  };
}

describe("SiteBoard", () => {
  it("assigns increasing seq and rejects older seq", () => {
    const board = new SiteBoard({ staleMs: 15_000, expireMs: 45_000 });
    const first = board.apply("alder-harbor", track("TRK-1"), 4);
    const ignored = board.apply("alder-harbor", track("TRK-1"), 3);
    const next = board.apply("alder-harbor", track("TRK-1"), 5);
    expect(first?.seq).toBe(4);
    expect(ignored).toBeNull();
    expect(next?.seq).toBe(5);
  });

  it("expires tracks older than EXPIRE_MS", () => {
    const board = new SiteBoard({ staleMs: 100, expireMs: 200 });
    const old = new Date(Date.now() - 1000).toISOString();
    board.apply("alder-harbor", track("TRK-old", old));
    const removed = board.expire();
    expect(removed).toContain("TRK-old");
    expect(board.size()).toBe(0);
  });

  it("marks stale before expire", () => {
    const board = new SiteBoard({ staleMs: 50, expireMs: 10_000 });
    const aged = new Date(Date.now() - 80).toISOString();
    const record = board.apply("alder-harbor", track("TRK-s", aged));
    expect(record).toBeTruthy();
    expect(board.isStale(record!)).toBe(true);
  });
});
