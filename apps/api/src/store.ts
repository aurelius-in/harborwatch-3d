import bcrypt from "bcryptjs";
import pg from "pg";
import type {
  AlertEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
  SensorTelemetry,
  TrackUpdate,
  UserSession,
} from "@harborwatch/contracts";
import { SITE, SITE_ID } from "./site.ts";

export interface StoredUser extends UserSession {
  password_hash: string;
}

export interface HistoryPoint {
  track_id: string;
  latitude: number;
  longitude: number;
  speed_mps: number;
  heading: number;
  timestamp: string;
}

export interface DataStore {
  getUserByEmail(email: string): Promise<StoredUser | undefined>;
  getUserById(userId: string): Promise<StoredUser | undefined>;
  listUsers(): Promise<StoredUser[]>;
  insertHistory(point: HistoryPoint): Promise<void>;
  getHistory(trackId: string, limit?: number): Promise<HistoryPoint[]>;
  listAlerts(siteId: string): Promise<AlertEvent[]>;
  upsertAlert(alert: AlertEvent): Promise<void>;
  ackAlert(alertId: string): Promise<AlertEvent | undefined>;
  insertAudit(entry: {
    actor: string;
    action: string;
    site_id: string;
    target: string;
  }): Promise<void>;
  health(): Promise<boolean>;
}

function demoUsers(): StoredUser[] {
  const hash = (password: string) => bcrypt.hashSync(password, 8);
  const sites = [SITE_ID];
  return [
    {
      user_id: "usr-viewer",
      email: "viewer@harborwatch.local",
      role: "viewer",
      site_ids: sites,
      password_hash: hash("viewer"),
    },
    {
      user_id: "usr-operator",
      email: "operator@harborwatch.local",
      role: "operator",
      site_ids: sites,
      password_hash: hash("operator"),
    },
    {
      user_id: "usr-admin",
      email: "admin@harborwatch.local",
      role: "admin",
      site_ids: sites,
      password_hash: hash("admin"),
    },
  ];
}

export class MemoryStore implements DataStore {
  private users = demoUsers();
  private history: HistoryPoint[] = [];
  private alerts: AlertEvent[] = [];
  private audit: Array<Record<string, string>> = [];

  async getUserByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }
  async getUserById(userId: string) {
    return this.users.find((u) => u.user_id === userId);
  }
  async listUsers() {
    return this.users;
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
  async insertAudit(entry: {
    actor: string;
    action: string;
    site_id: string;
    target: string;
  }) {
    this.audit.push({ ...entry, timestamp: new Date().toISOString() });
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
      CREATE TABLE IF NOT EXISTS track_history (
        id BIGSERIAL PRIMARY KEY,
        track_id TEXT NOT NULL,
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
    for (const user of demoUsers()) {
      await this.pool.query(
        `INSERT INTO users (user_id, email, password_hash, role, site_ids)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           site_ids = EXCLUDED.site_ids`,
        [user.user_id, user.email, user.password_hash, user.role, user.site_ids],
      );
    }
  }

  async getUserByEmail(email: string) {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    return rows[0] as StoredUser | undefined;
  }
  async getUserById(userId: string) {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE user_id = $1",
      [userId],
    );
    return rows[0] as StoredUser | undefined;
  }
  async listUsers() {
    const { rows } = await this.pool.query("SELECT * FROM users");
    return rows as StoredUser[];
  }
  async insertHistory(point: HistoryPoint) {
    await this.pool.query(
      `INSERT INTO track_history
        (track_id, latitude, longitude, speed_mps, heading, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        point.track_id,
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
      `SELECT track_id, latitude, longitude, speed_mps, heading, timestamp
       FROM track_history WHERE track_id = $1
       ORDER BY timestamp DESC LIMIT $2`,
      [trackId, limit],
    );
    return rows.reverse() as HistoryPoint[];
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
  async insertAudit(entry: {
    actor: string;
    action: string;
    site_id: string;
    target: string;
  }) {
    await this.pool.query(
      `INSERT INTO audit_log (actor, action, site_id, target) VALUES ($1,$2,$3,$4)`,
      [entry.actor, entry.action, entry.site_id, entry.target],
    );
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

export { SITE, SITE_ID };
export type LiveSensor = SensorTelemetry;
export type LiveEnvironment = EnvironmentalTelemetry;
export type LiveDevice = DeviceStatus;
export type LiveTrack = TrackUpdate;
