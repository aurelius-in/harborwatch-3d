export const SCHEMA = {
  track: "harborwatch.track/1",
  sensor_telemetry: "harborwatch.sensor_telemetry/1",
  environment: "harborwatch.environment/1",
  device_status: "harborwatch.device_status/1",
  alert: "harborwatch.alert/1",
  track_expire: "harborwatch.track_expire/1",
} as const;

export type ObjectType = "vessel" | "vehicle" | "person" | "unknown";
export type SensorStatus = "operational" | "degraded" | "offline";
export type Role = "viewer" | "operator" | "admin";
export type DeviceKind = "lidar" | "gateway" | "radio" | "other";
export type EnvelopeType =
  | "track"
  | "sensor_telemetry"
  | "environment"
  | "device_status"
  | "alert"
  | "track_expire";
export type AlertKind =
  | "sensor_offline"
  | "restricted_zone"
  | "stale_ingest"
  | "unknown_contact"
  | "low_visibility"
  | "stale_sensor";
export type AlertSeverity = "info" | "warning" | "critical";

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface StreamEnvelope<T> {
  type: EnvelopeType;
  schema: string;
  site_id: string;
  seq?: number;
  sent_at: string;
  payload: T;
}

export interface TrackUpdate {
  track_id: string;
  object_type: ObjectType;
  latitude: number;
  longitude: number;
  altitude: number;
  speed_mps: number;
  heading: number;
  confidence: number;
  sensor_id: string;
  timestamp: string;
  last_seen: string;
}

export interface SensorTelemetry {
  sensor_id: string;
  site_id: string;
  status: SensorStatus;
  temperature_c: number;
  humidity_percent: number;
  visibility_meters: number;
  wind_speed_mps: number;
  wind_direction: number;
  battery_percent?: number;
  timestamp: string;
}

export interface EnvironmentalTelemetry {
  site_id: string;
  visibility_meters: number;
  wind_speed_mps: number;
  wind_direction: number;
  temperature_c: number;
  sea_state?: number;
  timestamp: string;
}

export interface DeviceStatus {
  device_id: string;
  site_id: string;
  kind: DeviceKind;
  connected: boolean;
  latitude?: number;
  longitude?: number;
  last_heartbeat: string;
}

export interface RestrictedZone {
  zone_id: string;
  name: string;
  polygon: GeoJsonPolygon;
}

export interface SiteConfiguration {
  site_id: string;
  name: string;
  extent: { xmin: number; ymin: number; xmax: number; ymax: number };
  default_camera?: { longitude: number; latitude: number; height: number };
  restricted_zones: RestrictedZone[];
}

export interface UserSession {
  user_id: string;
  email: string;
  role: Role;
  site_ids: string[];
}

export interface AlertEvent {
  alert_id: string;
  site_id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  track_id?: string;
  sensor_id?: string;
  acknowledged: boolean;
  created_at: string;
}

export interface AuditEvent {
  id?: number | string;
  actor: string;
  action: string;
  site_id: string;
  target: string;
  timestamp: string;
}

export interface TrackExpirePayload {
  track_ids: string[];
}

export interface HistoryPoint {
  track_id: string;
  site_id: string;
  latitude: number;
  longitude: number;
  speed_mps: number;
  heading: number;
  timestamp: string;
}

export const OBJECT_TYPES: ObjectType[] = ["vessel", "vehicle", "person", "unknown"];
export const ROLES: Role[] = ["viewer", "operator", "admin"];
export const ALERT_KINDS: AlertKind[] = [
  "sensor_offline",
  "restricted_zone",
  "stale_ingest",
  "unknown_contact",
  "low_visibility",
  "stale_sensor",
];

export function isObjectType(value: string): value is ObjectType {
  return OBJECT_TYPES.includes(value as ObjectType);
}

export function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}

export function isAlertKind(value: string): value is AlertKind {
  return ALERT_KINDS.includes(value as AlertKind);
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`invalid ${field}`);
  }
  return value;
}

export function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`invalid ${field}`);
  }
  return value;
}

export function parseTrackUpdate(input: unknown): TrackUpdate {
  if (!input || typeof input !== "object") {
    throw new Error("track payload must be an object");
  }
  const raw = input as Record<string, unknown>;
  const object_type = requiredString(raw.object_type, "object_type");
  if (!isObjectType(object_type)) {
    throw new Error("invalid object_type");
  }
  const confidence = requiredNumber(raw.confidence, "confidence");
  if (confidence < 0 || confidence > 1) {
    throw new Error("confidence must be 0 to 1");
  }
  return {
    track_id: requiredString(raw.track_id, "track_id"),
    object_type,
    latitude: requiredNumber(raw.latitude, "latitude"),
    longitude: requiredNumber(raw.longitude, "longitude"),
    altitude: requiredNumber(raw.altitude, "altitude"),
    speed_mps: requiredNumber(raw.speed_mps, "speed_mps"),
    heading: requiredNumber(raw.heading, "heading"),
    confidence,
    sensor_id: requiredString(raw.sensor_id, "sensor_id"),
    timestamp: requiredString(raw.timestamp, "timestamp"),
    last_seen: requiredString(raw.last_seen, "last_seen"),
  };
}

export function parseEnvelope<T>(
  input: unknown,
  parsePayload: (payload: unknown) => T,
): StreamEnvelope<T> {
  if (!input || typeof input !== "object") {
    throw new Error("envelope must be an object");
  }
  const raw = input as Record<string, unknown>;
  return {
    type: requiredString(raw.type, "type") as EnvelopeType,
    schema: requiredString(raw.schema, "schema"),
    site_id: requiredString(raw.site_id, "site_id"),
    seq: raw.seq === undefined ? undefined : requiredNumber(raw.seq, "seq"),
    sent_at: requiredString(raw.sent_at, "sent_at"),
    payload: parsePayload(raw.payload),
  };
}
