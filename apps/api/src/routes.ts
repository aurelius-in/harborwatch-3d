import bcrypt from "bcryptjs";
import { Router, type Request, type Response, type NextFunction } from "express";
import {
  canAckAlerts,
  canQueryHistory,
  signSession,
  verifySession,
  type TokenUser,
} from "@harborwatch/auth";
import { snapshotMetrics } from "@harborwatch/telemetry";
import type { AppContext } from "./context.ts";
import { handleIngest } from "./ingest.ts";
import { SENSORS, SITE, SITE_ID } from "./site.ts";

export type AuthedRequest = Request & { user?: TokenUser };

export function createRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/api/health", async (_req, res) => {
    ctx.board.expire();
    const dbOk = await ctx.store.health().catch(() => false);
    const ingestAge =
      ctx.lastIngestAt === 0 ? null : (Date.now() - ctx.lastIngestAt) / 1000;
    let status: "ok" | "degraded" | "error" = "ok";
    if (!dbOk) status = "degraded";
    if (ingestAge !== null && ingestAge > 30) status = "degraded";
    res.json({
      status,
      api: "ok",
      database: dbOk ? "ok" : "error",
      ingest_age_s: ingestAge,
      ws_clients: ctx.clients.size,
      board_size: ctx.board.size(),
      metrics: snapshotMetrics(),
    });
  });

  router.post("/api/auth/login", async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const user = await ctx.store.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      ctx.logger.warn({ event: "auth.deny", service: "api" });
      res.status(401).json({ error: "invalid credentials" });
      return;
    }
    const session = {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      site_ids: user.site_ids,
    };
    const token = signSession(session, ctx.config.jwtSecret);
    ctx.logger.info({ event: "auth.login", service: "api", user_id: user.user_id });
    res.json({ token, user: session });
  });

  router.post("/api/ingest", async (req, res) => {
    const key = String(req.header("x-ingest-key") ?? "");
    if (key !== ctx.config.ingestKey) {
      res.status(401).json({ error: "invalid ingest key" });
      return;
    }
    const result = await handleIngest(ctx, req.body);
    res.status(result.accepted ? 202 : 400).json(result);
  });

  router.use("/api", authMiddleware(ctx));

  router.get("/api/user", (req: AuthedRequest, res) => {
    res.json(req.user);
  });

  router.get("/api/sites", (req: AuthedRequest, res) => {
    const allowed = req.user?.site_ids.includes(SITE.site_id);
    res.json(allowed ? [SITE] : []);
  });

  router.get("/api/sensors", (req: AuthedRequest, res) => {
    if (!req.user?.site_ids.includes(SITE_ID)) {
      res.status(403).json({ error: "site not permitted" });
      return;
    }
    const list = SENSORS.map((meta) => ({
      ...meta,
      telemetry: ctx.sensors.get(meta.sensor_id) ?? null,
    }));
    res.json(list);
  });

  router.get("/api/devices", (req: AuthedRequest, res) => {
    if (!req.user?.site_ids.includes(SITE_ID)) {
      res.status(403).json({ error: "site not permitted" });
      return;
    }
    res.json([...ctx.devices.values()]);
  });

  router.get("/api/environment", (req: AuthedRequest, res) => {
    if (!req.user?.site_ids.includes(SITE_ID)) {
      res.status(403).json({ error: "site not permitted" });
      return;
    }
    res.json(ctx.environment);
  });

  router.get("/api/tracks", (req: AuthedRequest, res) => {
    if (!req.user?.site_ids.includes(SITE_ID)) {
      res.status(403).json({ error: "site not permitted" });
      return;
    }
    const now = Date.now();
    res.json(
      ctx.board.snapshot().map((track) => ({
        ...track,
        stale: ctx.board.isStale(track, now),
      })),
    );
  });

  router.get("/api/tracks/:id/history", async (req: AuthedRequest, res) => {
    if (!req.user || !canQueryHistory(req.user.role)) {
      res.status(403).json({ error: "history requires operator or admin" });
      return;
    }
    const history = await ctx.store.getHistory(req.params.id, 300);
    res.json(history);
  });

  router.get("/api/alerts", async (req: AuthedRequest, res) => {
    if (!req.user?.site_ids.includes(SITE_ID)) {
      res.status(403).json({ error: "site not permitted" });
      return;
    }
    res.json(await ctx.store.listAlerts(SITE_ID));
  });

  router.post("/api/alerts/:id/ack", async (req: AuthedRequest, res) => {
    if (!req.user || !canAckAlerts(req.user.role)) {
      res.status(403).json({ error: "acknowledge requires operator or admin" });
      return;
    }
    const alert = await ctx.store.ackAlert(req.params.id);
    if (!alert) {
      res.status(404).json({ error: "alert not found" });
      return;
    }
    await ctx.store.insertAudit({
      actor: req.user.user_id,
      action: "alert.ack",
      site_id: SITE_ID,
      target: req.params.id,
    });
    res.json(alert);
  });

  return router;
}

function authMiddleware(ctx: AppContext) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "missing token" });
      return;
    }
    try {
      req.user = verifySession(token, ctx.config.jwtSecret);
      next();
    } catch {
      ctx.logger.warn({ event: "auth.deny", service: "api" });
      res.status(401).json({ error: "invalid token" });
    }
  };
}
