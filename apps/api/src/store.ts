import bcrypt from "bcryptjs";
import pg from "pg";
import type {
  AlertEvent,
  AuditEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
  HistoryPoint,
  Role,
  SensorTelemetry,
  SiteConfiguration,
  TrackUpdate,
  UserSession,
} from "@harborwatch/contracts";
import { isRole } from "@harborwatch/contracts";
import { SITE_CATALOG, SITE_IDS, toSiteConfiguration, type SiteDefinition } from "./site.ts";

export interface StoredUser extends UserSession {
  password_hash: string;
}

export interface DataStore {
  getUserByEmail(email: string): Promise<StoredUser | undefined>;
  getUserById(userId: string): Promise<StoredUser | undefined>;
  listUsers(): Promise<StoredUser[]>;
  updateUser(
    userId: string,
    patch: { role?: Role; site_ids?: string[] },
  ): Promise<StoredUser | undefined>;
  insertHistory(point: HistoryPoint): Promise<void>;
  getHistory(trackId: string, limit?: number): Promise<HistoryPoint[]>;
  purgeHistory(olderThanIso: string): Promise<number>;
  listAlerts(siteId: string): Promise<AlertEvent[]>;
  upsertAlert(alert: AlertEvent): Promise<void>;
  ackAlert(alertId: string): Promise<AlertEvent | undefined>;
  insertAudit(entry: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }): Promise<void>;
  listAudit(limit?: number): Promise<AuditEvent[]>;
  listSites(): Promise<SiteConfiguration[]>;
  updateSite(siteId: string, patch: { name?: string }): Promise<SiteConfiguration | undefined>;
  health(): Promise<boolean>;
}

const PASSWORD_HASHES = {
  viewer: bcrypt.hashSync("viewer", 8),
  operator: bcrypt.hashSync("operator", 8),
  admin: bcrypt.hashSync("admin", 8),
};

function demoUsers(): StoredUser[] {
  return [
    {
      user_id: "usr-viewer",
      email: "viewer@harborwatch.local",
      role: "viewer",
      site_ids: [...SITE_IDS],
      password_hash: PASSWORD_HASHES.viewer,
    },
    {
      user_id: "usr-operator",
      email: "operator@harborwatch.local",
      role: "operator",
      site_ids: [...SITE_IDS],
      password_hash: PASSWORD_HASHES.operator,
    },
    {
      user_id: "usr-admin",
      email: "admin@harborwatch.local",
      role: "admin",
      site_ids: [...SITE_IDS],
      password_hash: PASSWORD_HASHES.admin,
    },
  ];
}

function cloneSites(): SiteDefinition[] {
  return SITE_CATALOG.map((site) => structuredClone(site));
}

function asSiteConfiguration(site: SiteDefinition | SiteConfiguration): SiteConfiguration {
  return {
    site_id: site.site_id,
    name: site.name,
    extent: site.extent,
    default_camera: site.default_camera,
    restricted_zones: site.restricted_zones,
  };
}

export class MemoryStore implements DataStore {
  private users = demoUsers();
  private history: HistoryPoint[] = [];
  private alerts: AlertEvent[] = [];
  private audit: AuditEvent[] = [];
  private sites = cloneSites();

  async getUserByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }
  async getUserById(userId: string) {
    return this.users.find((u) => u.user_id === userId);
  }
  async listUsers() {
    return this.users;
  }
  async updateUser(userId: string, patch: { role?: Role; site_ids?: string[] }) {
    const user = this.users.find((u) => u.user_id === userId);
    if (!user) return undefined;
    if (patch.role && isRole(patch.role)) user.role = patch.role;
    if (patch.site_ids) user.site_ids = patch.site_ids;
    return user;
  }
  async insertHistory(point: HistoryPoint) {
    this.history.push(point);
    if (this.history.length > 20_000) {
      this.history.splice(0, this.history.length - 16_000);
    }
  }
  async getHistory(trackId: string, limit = 200) {
    return this.history.filter((p) => p.track_id === trackId).slice(-limit);
  }
  async purgeHistory(olderThanIso: string) {
    const cutoff = Date.parse(olderThanIso);
    const before = this.history.length;
    this.history = this.history.filter((p) => Date.parse(p.timestamp) >= cutoff);
    return before - this.history.length;
  }
  async listAlerts(siteId: string) {
    return this.alerts.filter((a) => a.site_id === siteId);
  }
  async upsertAlert(alert: AlertEvent) {
    const idx = this.alerts.findIndex((a) => a.alert_id === alert.alert_id);
    if (idx >= 0) this.alerts[idx] = alert;
    else this.alerts.unshift(alert);
    if (this.alerts.length > 200) this.alerts.length = 200;
  }
  async ackAlert(alertId: string) {
    const alert = this.alerts.find((a) => a.alert_id === alertId);
    if (!alert) return undefined;
    alert.acknowledged = true;
    return alert;
  }
  async insertAudit(entry: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }) {
    this.audit.unshift({
      ...entry,
      id: this.audit.length + 1,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    });
    if (this.audit.length > 500) this.audit.length = 500;
  }
  async listAudit(limit = 100) {
    return this.audit.slice(0, limit);
  }
  async listSites() {
    return this.sites.map(asSiteConfiguration);
  }
  async updateSite(siteId: string, patch: { name?: string }) {
    const site = this.sites.find((s) => s.site_id === siteId);
    if (!site) return undefined;
    if (patch.name && patch.name.trim()) site.name = patch.name.trim();
    return asSiteConfiguration(site);
  }
  async health() {
    return true;
  }
}

export class PostgresStore implements DataStore {
  constructor(private readonly pool: pg.Pool) {}

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        site_ids TEXT[] NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sites (
        site_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS track_history (
        id BIGSERIAL PRIMARY KEY,
        track_id TEXT NOT NULL,
        site_id TEXT NOT NULL DEFAULT 'alder-harbor',
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        speed_mps DOUBLE PRECISION NOT NULL,
        heading DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS track_history_track_ts
        ON track_history (track_id, timestamp);
      CREATE TABLE IF NOT EXISTS alerts (
        alert_id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        track_id TEXT,
        sensor_id TEXT,
        acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        site_id TEXT NOT NULL,
        target TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(
      `ALTER TABLE track_history ADD COLUMN IF NOT EXISTS site_id TEXT NOT NULL DEFAULT 'alder-harbor'`,
    );
    for (const user of demoUsers()) {
      await this.pool.query(
        `INSERT INTO users (user_id, email, password_hash, role, site_ids)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           site_ids = EXCLUDED.site_ids`,
        [user.user_id, user.email, user.password_hash, user.role, user.site_ids],
      );
    }
    for (const site of SITE_CATALOG) {
      await this.pool.query(
        `INSERT INTO sites (site_id, name, config)
         VALUES ($1, $2, $3)
         ON CONFLICT (site_id) DO NOTHING`,
        [site.site_id, site.name, toSiteConfiguration(site)],
      );
    }
  }

  async getUserByEmail(email: string) {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return rows[0] as StoredUser | undefined;
  }
  async getUserById(userId: string) {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE user_id = $1", [userId]);
    return rows[0] as StoredUser | undefined;
  }
  async listUsers() {
    const { rows } = await this.pool.query("SELECT * FROM users ORDER BY email");
    return rows as StoredUser[];
  }
  async updateUser(userId: string, patch: { role?: Role; site_ids?: string[] }) {
    const current = await this.getUserById(userId);
    if (!current) return undefined;
    const role = patch.role && isRole(patch.role) ? patch.role : current.role;
    const siteIds = patch.site_ids ?? current.site_ids;
    const { rows } = await this.pool.query(
      `UPDATE users SET role = $2, site_ids = $3 WHERE user_id = $1 RETURNING *`,
      [userId, role, siteIds],
    );
    return rows[0] as StoredUser | undefined;
  }
  async insertHistory(point: HistoryPoint) {
    await this.pool.query(
      `INSERT INTO track_history
        (track_id, site_id, latitude, longitude, speed_mps, heading, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        point.track_id,
        point.site_id,
        point.latitude,
        point.longitude,
        point.speed_mps,
        point.heading,
        point.timestamp,
      ],
    );
  }
  async getHistory(trackId: string, limit = 200) {
    const { rows } = await this.pool.query(
      `SELECT track_id, site_id, latitude, longitude, speed_mps, heading, timestamp
       FROM track_history WHERE track_id = $1
       ORDER BY timestamp DESC LIMIT $2`,
      [trackId, limit],
    );
    return rows.reverse() as HistoryPoint[];
  }
  async purgeHistory(olderThanIso: string) {
    const { rowCount } = await this.pool.query(
      `DELETE FROM track_history WHERE timestamp < $1`,
      [olderThanIso],
    );
    return rowCount ?? 0;
  }
  async listAlerts(siteId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM alerts WHERE site_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [siteId],
    );
    return rows as AlertEvent[];
  }
  async upsertAlert(alert: AlertEvent) {
    await this.pool.query(
      `INSERT INTO alerts
        (alert_id, site_id, kind, severity, message, track_id, sensor_id, acknowledged, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (alert_id) DO UPDATE SET
         message = EXCLUDED.message,
         severity = EXCLUDED.severity,
         acknowledged = EXCLUDED.acknowledged`,
      [
        alert.alert_id,
        alert.site_id,
        alert.kind,
        alert.severity,
        alert.message,
        alert.track_id ?? null,
        alert.sensor_id ?? null,
        alert.acknowledged,
        alert.created_at,
      ],
    );
  }
  async ackAlert(alertId: string) {
    const { rows } = await this.pool.query(
      `UPDATE alerts SET acknowledged = TRUE WHERE alert_id = $1 RETURNING *`,
      [alertId],
    );
    return rows[0] as AlertEvent | undefined;
  }
  async insertAudit(entry: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }) {
    await this.pool.query(
      `INSERT INTO audit_log (actor, action, site_id, target) VALUES ($1,$2,$3,$4)`,
      [entry.actor, entry.action, entry.site_id, entry.target],
    );
  }
  async listAudit(limit = 100) {
    const { rows } = await this.pool.query(
      `SELECT id, actor, action, site_id, target, timestamp
       FROM audit_log ORDER BY timestamp DESC LIMIT $1`,
      [limit],
    );
    return rows as AuditEvent[];
  }
  async listSites() {
    const { rows } = await this.pool.query(`SELECT site_id, name, config FROM sites ORDER BY name`);
    return rows.map((row) => {
      const config = row.config as SiteConfiguration;
      return {
        ...config,
        site_id: row.site_id as string,
        name: row.name as string,
      };
    });
  }
  async updateSite(siteId: string, patch: { name?: string }) {
    const sites = await this.listSites();
    const current = sites.find((s) => s.site_id === siteId);
    if (!current) return undefined;
    const name = patch.name?.trim() || current.name;
    const next = { ...current, name };
    await this.pool.query(`UPDATE sites SET name = $2, config = $3 WHERE site_id = $1`, [
      siteId,
      name,
      next,
    ]);
    return next;
  }
  async health() {
    const { rows } = await this.pool.query("SELECT 1 AS ok");
    return Number(rows[0]?.ok) === 1;
  }
}

export async function openStore(databaseUrl: string): Promise<DataStore> {
  if (!databaseUrl || databaseUrl.startsWith("memory:")) {
    return new MemoryStore();
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const store = new PostgresStore(pool);
  await store.init();
  return store;
}

export { SITE, SITE_ID, SITE_IDS } from "./site.ts";
export type LiveSensor = SensorTelemetry;
export type LiveEnvironment = EnvironmentalTelemetry;
export type LiveDevice = DeviceStatus;
export type LiveTrack = TrackUpdate;
