import bcrypt from "bcryptjs";
import { Router, type Request, type Response, type NextFunction } from "express";
import {
  canAckAlerts,
  canManageConfig,
  canQueryHistory,
  signSession,
  siteAllowed,
  verifySession,
  type TokenUser,
} from "@harborwatch/auth";
import { isRole } from "@harborwatch/contracts";
import { snapshotMetrics } from "@harborwatch/telemetry";
import type { AppContext } from "./context.ts";
import { handleIngest } from "./ingest.ts";
import { getSite } from "./site.ts";

export type AuthedRequest = Request & { user?: TokenUser };

function clientKey(req: Request): string {
  return String(req.ip ?? req.socket.remoteAddress ?? "unknown");
}

function publicUser(user: { user_id: string; email: string; role: string; site_ids: string[] }) {
  return {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    site_ids: user.site_ids,
  };
}

function siteFromQuery(req: AuthedRequest, res: Response): string | null {
  const requested = String(req.query.site_id ?? req.user?.site_ids[0] ?? "");
  if (!requested) {
    res.status(400).json({ error: "site_id required" });
    return null;
  }
  if (!req.user || !siteAllowed(req.user, requested)) {
    res.status(403).json({ error: "site not permitted" });
    return null;
  }
  return requested;
}

export function createRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/api/health", async (_req, res) => {
    ctx.board.expire();
    const dbOk = await ctx.store.health().catch(() => false);
    const ingestAge =
      ctx.lastIngestAt === 0 ? null : (Date.now() - ctx.lastIngestAt) / 1000;
    const sites: Record<string, { ingest_age_s: number | null; board_size: number }> = {};
    for (const siteId of ctx.board.siteIds()) {
      const last = ctx.lastIngestBySite.get(siteId) ?? 0;
      sites[siteId] = {
        ingest_age_s: last === 0 ? null : (Date.now() - last) / 1000,
        board_size: ctx.board.size(siteId),
      };
    }
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
      sites,
      metrics: snapshotMetrics(),
    });
  });

  router.get("/api/metrics", (_req, res) => {
    res.json(snapshotMetrics());
  });

  router.post("/api/auth/login", async (req, res) => {
    if (!ctx.loginLimiter.allow(clientKey(req))) {
      res.status(429).json({ error: "too many login attempts" });
      return;
    }
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
    await ctx.store.insertAudit({
      actor: user.user_id,
      action: "auth.login",
      site_id: user.site_ids[0] ?? "alder-harbor",
      target: user.email,
    });
    ctx.logger.info({ event: "auth.login", service: "api", user_id: user.user_id });
    res.json({ token, user: session });
  });

  router.post("/api/ingest", async (req, res) => {
    if (!ctx.ingestLimiter.allow(clientKey(req))) {
      res.status(429).json({ error: "ingest rate exceeded" });
      return;
    }
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

  router.get("/api/sites", async (req: AuthedRequest, res) => {
    const all = await ctx.store.listSites();
    res.json(all.filter((site) => req.user?.site_ids.includes(site.site_id)));
  });

  router.get("/api/sensors", (req: AuthedRequest, res) => {
    const siteId = siteFromQuery(req, res);
    if (!siteId) return;
    const site = getSite(siteId);
    const list = (site?.sensors ?? []).map((meta) => ({
      ...meta,
      telemetry: ctx.sensors.get(meta.sensor_id) ?? null,
    }));
    res.json(list);
  });

  router.get("/api/devices", (req: AuthedRequest, res) => {
    const siteId = siteFromQuery(req, res);
    if (!siteId) return;
    res.json([...ctx.devices.values()].filter((device) => device.site_id === siteId));
  });

  router.get("/api/environment", (req: AuthedRequest, res) => {
    const siteId = siteFromQuery(req, res);
    if (!siteId) return;
    res.json(ctx.environments.get(siteId) ?? null);
  });

  router.get("/api/tracks", (req: AuthedRequest, res) => {
    const siteId = siteFromQuery(req, res);
    if (!siteId) return;
    const now = Date.now();
    res.json(
      ctx.board.snapshot(siteId).map((track) => ({
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
    const siteId = siteFromQuery(req, res);
    if (!siteId) return;
    res.json(await ctx.store.listAlerts(siteId));
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
      site_id: alert.site_id,
      target: req.params.id,
    });
    res.json(alert);
  });

  router.post("/api/audit", async (req: AuthedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: "missing token" });
      return;
    }
    const action = String(req.body?.action ?? "").trim();
    const target = String(req.body?.target ?? "").trim();
    const siteId = String(req.body?.site_id ?? req.user.site_ids[0] ?? "");
    if (!action || !target) {
      res.status(400).json({ error: "action and target required" });
      return;
    }
    if (!siteAllowed(req.user, siteId)) {
      res.status(403).json({ error: "site not permitted" });
      return;
    }
    await ctx.store.insertAudit({
      actor: req.user.user_id,
      action,
      site_id: siteId,
      target,
    });
    res.status(201).json({ ok: true });
  });

  router.get("/api/audit", async (req: AuthedRequest, res) => {
    if (!req.user || !canManageConfig(req.user.role)) {
      res.status(403).json({ error: "audit requires admin" });
      return;
    }
    const limit = Number(req.query.limit ?? 80);
    res.json(await ctx.store.listAudit(Number.isFinite(limit) ? limit : 80));
  });

  router.get("/api/users", async (req: AuthedRequest, res) => {
    if (!req.user || !canManageConfig(req.user.role)) {
      res.status(403).json({ error: "users require admin" });
      return;
    }
    const users = await ctx.store.listUsers();
    res.json(users.map(publicUser));
  });

  router.patch("/api/users/:id", async (req: AuthedRequest, res) => {
    if (!req.user || !canManageConfig(req.user.role)) {
      res.status(403).json({ error: "users require admin" });
      return;
    }
    const roleRaw = req.body?.role === undefined ? undefined : String(req.body.role);
    if (roleRaw !== undefined && !isRole(roleRaw)) {
      res.status(400).json({ error: "invalid role" });
      return;
    }
    const updated = await ctx.store.updateUser(req.params.id, {
      role: roleRaw,
      site_ids: Array.isArray(req.body?.site_ids) ? req.body.site_ids.map(String) : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: "user not found" });
      return;
    }
    await ctx.store.insertAudit({
      actor: req.user.user_id,
      action: "user.role",
      site_id: updated.site_ids[0] ?? "alder-harbor",
      target: `${updated.email}:${updated.role}`,
    });
    res.json(publicUser(updated));
  });

  router.patch("/api/sites/:id", async (req: AuthedRequest, res) => {
    if (!req.user || !canManageConfig(req.user.role)) {
      res.status(403).json({ error: "site config requires admin" });
      return;
    }
    const site = await ctx.store.updateSite(req.params.id, { name: req.body?.name });
    if (!site) {
      res.status(404).json({ error: "site not found" });
      return;
    }
    await ctx.store.insertAudit({
      actor: req.user.user_id,
      action: "site.config",
      site_id: site.site_id,
      target: site.name,
    });
    res.json(site);
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
