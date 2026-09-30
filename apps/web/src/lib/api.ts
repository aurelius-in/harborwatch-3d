import type {
  AlertEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
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
  sensors: (token: string) => request<SensorRecord[]>("/api/sensors", token),
  devices: (token: string) => request<DeviceStatus[]>("/api/devices", token),
  environment: (token: string) =>
    request<EnvironmentalTelemetry | null>("/api/environment", token),
  tracks: (token: string) => request<TrackRecord[]>("/api/tracks", token),
  history: (token: string, id: string) =>
    request<Array<{ latitude: number; longitude: number; timestamp: string; speed_mps: number; heading: number }>>(
      `/api/tracks/${id}/history`,
      token,
    ),
  alerts: (token: string) => request<AlertEvent[]>("/api/alerts", token),
  ackAlert: (token: string, id: string) =>
    request<AlertEvent>(`/api/alerts/${id}/ack`, token, { method: "POST" }),
  health: () => request<{ status: string; ingest_age_s: number | null; ws_clients: number; board_size: number }>(
    "/api/health",
    null,
  ),
};

export function wsUrl(path: string, token: string): string {
  const configured = import.meta.env.VITE_WS_BASE;
  if (configured) return `${configured}${path}?token=${encodeURIComponent(token)}`;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${path}?token=${encodeURIComponent(token)}`;
}
