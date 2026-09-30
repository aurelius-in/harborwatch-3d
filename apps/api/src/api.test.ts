import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createContext } from "./context.ts";
import { MemoryStore } from "./store.ts";
import { SCHEMA } from "@harborwatch/contracts";
import { canAckAlerts, canManageConfig, canQueryHistory } from "@harborwatch/auth";

describe("RBAC helpers", () => {
  it("keeps viewer read-only", () => {
    expect(canAckAlerts("viewer")).toBe(false);
    expect(canQueryHistory("viewer")).toBe(false);
    expect(canManageConfig("viewer")).toBe(false);
    expect(canAckAlerts("operator")).toBe(true);
    expect(canManageConfig("admin")).toBe(true);
  });
});

describe("API", () => {
  it("logs in a viewer and serves session, sites, and health", async () => {
    const ctx = createContext(
      { ...loadConfig({ DATABASE_URL: "memory://test" }), databaseUrl: "memory://test" },
      new MemoryStore(),
    );
    const app = createApp(ctx);
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body.api).toBe("ok");

    const denied = await request(app).get("/api/user");
    expect(denied.status).toBe(401);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@harborwatch.local", password: "viewer" });
    expect(login.status).toBe(200);
    const token = login.body.token as string;
    const me = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${token}`);
    expect(me.body.role).toBe("viewer");
    const sites = await request(app)
      .get("/api/sites")
      .set("Authorization", `Bearer ${token}`);
    expect(sites.body[0].site_id).toBe("alder-harbor");
  });

  it("accepts ingest with the service key and rejects without it", async () => {
    const config = loadConfig({ DATABASE_URL: "memory://test" });
    const ctx = createContext(config, new MemoryStore());
    const app = createApp(ctx);
    const payload = {
      type: "track",
      schema: SCHEMA.track,
      site_id: "alder-harbor",
      sent_at: new Date().toISOString(),
      payload: {
        track_id: "TRK-0099",
        object_type: "vessel",
        latitude: 47.627,
        longitude: -122.409,
        altitude: 0.2,
        speed_mps: 2.4,
        heading: 12,
        confidence: 0.8,
        sensor_id: "LIDAR-03",
        timestamp: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      },
    };
    const bad = await request(app).post("/api/ingest").send(payload);
    expect(bad.status).toBe(401);
    const ok = await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(payload);
    expect(ok.status).toBe(202);
    expect(ctx.board.get("TRK-0099")?.object_type).toBe("vessel");
  });

  it("blocks viewers from acknowledging alerts", async () => {
    const config = loadConfig({ DATABASE_URL: "memory://test" });
    const ctx = createContext(config, new MemoryStore());
    const app = createApp(ctx);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@harborwatch.local", password: "viewer" });
    const ack = await request(app)
      .post("/api/alerts/x/ack")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(ack.status).toBe(403);
  });
});
