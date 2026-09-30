import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import request from "supertest";
import WebSocket from "ws";
import { SCHEMA } from "@harborwatch/contracts";
import { canAckAlerts, canManageConfig, canQueryHistory } from "@harborwatch/auth";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createContext } from "./context.ts";
import { MemoryStore } from "./store.ts";
import { attachWebSockets } from "./ws.ts";

function harness() {
  const config = { ...loadConfig({ DATABASE_URL: "memory://test" }), databaseUrl: "memory://test" };
  const ctx = createContext(config, new MemoryStore());
  const app = createApp(ctx);
  return { config, ctx, app };
}

function trackPayload(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    track_id: "TRK-0099",
    object_type: "vessel",
    latitude: 47.627,
    longitude: -122.409,
    altitude: 0.2,
    speed_mps: 2.4,
    heading: 12,
    confidence: 0.8,
    sensor_id: "LIDAR-03",
    timestamp: now,
    last_seen: now,
    ...overrides,
  };
}

function trackEnvelope(siteId = "alder-harbor", payload = trackPayload(), seq = 1) {
  return {
    type: "track",
    schema: SCHEMA.track,
    site_id: siteId,
    seq,
    sent_at: new Date().toISOString(),
    payload,
  };
}

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

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
    const { app } = harness();
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body.api).toBe("ok");
    expect(health.body.sites["alder-harbor"]).toBeTruthy();
    expect(health.body.sites["cedar-inlet"]).toBeTruthy();

    const metrics = await request(app).get("/api/metrics");
    expect(metrics.status).toBe(200);

    const denied = await request(app).get("/api/user");
    expect(denied.status).toBe(401);

    const token = await login(app, "viewer@harborwatch.local", "viewer");
    const me = await request(app).get("/api/user").set("Authorization", `Bearer ${token}`);
    expect(me.body.role).toBe("viewer");
    const sites = await request(app).get("/api/sites").set("Authorization", `Bearer ${token}`);
    expect(sites.body.map((s: { site_id: string }) => s.site_id)).toEqual(
      expect.arrayContaining(["alder-harbor", "cedar-inlet"]),
    );
  });

  it("accepts ingest with the service key and rejects without it", async () => {
    const { app, config, ctx } = harness();
    const payload = trackEnvelope();
    const bad = await request(app).post("/api/ingest").send(payload);
    expect(bad.status).toBe(401);
    const ok = await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(payload);
    expect(ok.status).toBe(202);
    expect(ctx.board.get("TRK-0099")?.object_type).toBe("vessel");
  });

  it("rejects unknown sites and filters tracks by site_id", async () => {
    const { app, config } = harness();
    const unknown = await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(trackEnvelope("not-a-site"));
    expect(unknown.status).toBe(400);

    await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(
        trackEnvelope(
          "alder-harbor",
          trackPayload({ track_id: "AH-TEST", latitude: 47.627, longitude: -122.409 }),
          1,
        ),
      );
    await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(
        trackEnvelope(
          "cedar-inlet",
          trackPayload({
            track_id: "CI-TEST",
            latitude: 47.251,
            longitude: -122.461,
            sensor_id: "LIDAR-C1",
          }),
          1,
        ),
      );

    const token = await login(app, "operator@harborwatch.local", "operator");
    const alder = await request(app)
      .get("/api/tracks")
      .query({ site_id: "alder-harbor" })
      .set("Authorization", `Bearer ${token}`);
    const cedar = await request(app)
      .get("/api/tracks")
      .query({ site_id: "cedar-inlet" })
      .set("Authorization", `Bearer ${token}`);
    expect(alder.body.some((t: { track_id: string }) => t.track_id === "AH-TEST")).toBe(true);
    expect(alder.body.some((t: { track_id: string }) => t.track_id === "CI-TEST")).toBe(false);
    expect(cedar.body.some((t: { track_id: string }) => t.track_id === "CI-TEST")).toBe(true);
  });

  it("blocks viewers from acknowledging alerts and history", async () => {
    const { app, config } = harness();
    await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(
        trackEnvelope(
          "alder-harbor",
          trackPayload({
            track_id: "TRK-ZONE",
            latitude: 47.63,
            longitude: -122.4113,
          }),
          1,
        ),
      );
    const viewer = await login(app, "viewer@harborwatch.local", "viewer");
    const ack = await request(app)
      .post("/api/alerts/x/ack")
      .set("Authorization", `Bearer ${viewer}`);
    expect(ack.status).toBe(403);
    const history = await request(app)
      .get("/api/tracks/TRK-ZONE/history")
      .set("Authorization", `Bearer ${viewer}`);
    expect(history.status).toBe(403);
    const audit = await request(app).get("/api/audit").set("Authorization", `Bearer ${viewer}`);
    expect(audit.status).toBe(403);
  });

  it("lets operators ack alerts and query history", async () => {
    const { app, config } = harness();
    const ingest = await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(
        trackEnvelope(
          "alder-harbor",
          trackPayload({
            track_id: "TRK-ZONE",
            latitude: 47.63,
            longitude: -122.4113,
          }),
          1,
        ),
      );
    expect(ingest.status).toBe(202);
    const operator = await login(app, "operator@harborwatch.local", "operator");
    const alerts = await request(app)
      .get("/api/alerts")
      .query({ site_id: "alder-harbor" })
      .set("Authorization", `Bearer ${operator}`);
    const zone = alerts.body.find((a: { kind: string }) => a.kind === "restricted_zone");
    expect(zone).toBeTruthy();
    const ack = await request(app)
      .post(`/api/alerts/${zone.alert_id}/ack`)
      .set("Authorization", `Bearer ${operator}`);
    expect(ack.status).toBe(200);
    expect(ack.body.acknowledged).toBe(true);
    const history = await request(app)
      .get("/api/tracks/TRK-ZONE/history")
      .set("Authorization", `Bearer ${operator}`);
    expect(history.status).toBe(200);
    expect(history.body[0].track_id).toBe("TRK-ZONE");
    expect(history.body[0].site_id).toBe("alder-harbor");
  });

  it("raises low visibility alerts and lists them per site", async () => {
    const { app, config } = harness();
    await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send({
        type: "environment",
        schema: SCHEMA.environment,
        site_id: "alder-harbor",
        sent_at: new Date().toISOString(),
        payload: {
          site_id: "alder-harbor",
          visibility_meters: 900,
          wind_speed_mps: 8,
          wind_direction: 210,
          temperature_c: 10,
          timestamp: new Date().toISOString(),
        },
      });
    const operator = await login(app, "operator@harborwatch.local", "operator");
    const alerts = await request(app)
      .get("/api/alerts")
      .query({ site_id: "alder-harbor" })
      .set("Authorization", `Bearer ${operator}`);
    expect(alerts.body.some((a: { kind: string }) => a.kind === "low_visibility")).toBe(true);
  });

  it("lets admin list users, audit, and rename a site", async () => {
    const { app } = harness();
    const admin = await login(app, "admin@harborwatch.local", "admin");
    const users = await request(app).get("/api/users").set("Authorization", `Bearer ${admin}`);
    expect(users.status).toBe(200);
    expect(users.body.some((u: { email: string }) => u.email.includes("viewer"))).toBe(true);
    expect(users.body[0].password_hash).toBeUndefined();
    const audit = await request(app).get("/api/audit").set("Authorization", `Bearer ${admin}`);
    expect(audit.status).toBe(200);
    expect(audit.body.some((row: { action: string }) => row.action === "auth.login")).toBe(true);
    const renamed = await request(app)
      .patch("/api/sites/cedar-inlet")
      .set("Authorization", `Bearer ${admin}`)
      .send({ name: "Cedar Inlet North" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Cedar Inlet North");
  });
});

describe("WebSocket tracks", () => {
  it("snapshots ingested tracks to an authenticated client", async () => {
    const { app, config, ctx } = harness();
    const server: Server = createServer(app);
    attachWebSockets(server, ctx);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const token = await login(app, "operator@harborwatch.local", "operator");
    await request(app)
      .post("/api/ingest")
      .set("x-ingest-key", config.ingestKey)
      .send(trackEnvelope("alder-harbor", trackPayload({ track_id: "TRK-WS" }), 4));

    const received = await new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/tracks?token=${token}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("ws timeout"));
      }, 4000);
      ws.on("message", (raw) => {
        const text = String(raw);
        if (text.includes("TRK-WS")) {
          clearTimeout(timer);
          ws.close();
          resolve(text);
        }
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    expect(received).toContain("TRK-WS");
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
