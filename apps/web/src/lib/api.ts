import type {
  AlertEvent,
  AuditEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
  HistoryPoint,
  SensorTelemetry,
  SiteConfiguration,
  TrackUpdate,
  UserSession,
} from "@harborwatch/contracts";

const apiBase = () => import.meta.env.VITE_API_BASE ?? "";

export interface LoginResponse {
  token: string;
  user: UserSession;
}

export interface SensorRecord {
  sensor_id: string;
  name: string;
  latitude: number;
  longitude: number;
  telemetry: SensorTelemetry | null;
}

export interface TrackRecord extends TrackUpdate {
  seq: number;
  site_id: string;
  stale?: boolean;
}

export interface HealthSnapshot {
  status: string;
  api: string;
  database: string;
  ingest_age_s: number | null;
  ws_clients: number;
  board_size: number;
  sites?: Record<string, { ingest_age_s: number | null; board_size: number }>;
  metrics?: Record<string, number>;
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  user: (token: string) => request<UserSession>("/api/user", token),
  sites: (token: string) => request<SiteConfiguration[]>("/api/sites", token),
  sensors: (token: string, siteId: string) =>
    request<SensorRecord[]>(`/api/sensors?site_id=${encodeURIComponent(siteId)}`, token),
  devices: (token: string, siteId: string) =>
    request<DeviceStatus[]>(`/api/devices?site_id=${encodeURIComponent(siteId)}`, token),
  environment: (token: string, siteId: string) =>
    request<EnvironmentalTelemetry | null>(
      `/api/environment?site_id=${encodeURIComponent(siteId)}`,
      token,
    ),
  tracks: (token: string, siteId: string) =>
    request<TrackRecord[]>(`/api/tracks?site_id=${encodeURIComponent(siteId)}`, token),
  history: (token: string, id: string) => request<HistoryPoint[]>(`/api/tracks/${id}/history`, token),
  alerts: (token: string, siteId: string) =>
    request<AlertEvent[]>(`/api/alerts?site_id=${encodeURIComponent(siteId)}`, token),
  ackAlert: (token: string, id: string) =>
    request<AlertEvent>(`/api/alerts/${id}/ack`, token, { method: "POST" }),
  health: () => request<HealthSnapshot>("/api/health", null),
  metrics: () => request<Record<string, number>>("/api/metrics", null),
  audit: (token: string, body: { action: string; target: string; site_id: string }) =>
    request<{ ok: boolean }>("/api/audit", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAudit: (token: string) => request<AuditEvent[]>("/api/audit", token),
  users: (token: string) => request<UserSession[]>("/api/users", token),
  patchUser: (token: string, id: string, body: { role?: string; site_ids?: string[] }) =>
    request<UserSession>(`/api/users/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  patchSite: (token: string, id: string, body: { name: string }) =>
    request<SiteConfiguration>(`/api/sites/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export function wsUrl(path: string, token: string): string {
  const configured = import.meta.env.VITE_WS_BASE;
  if (configured) return `${configured}${path}?token=${encodeURIComponent(token)}`;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${path}?token=${encodeURIComponent(token)}`;
}
