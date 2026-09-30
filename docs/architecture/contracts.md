<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Contracts

> Shared event schemas and how they version.

Source of truth lives in `packages/contracts`. The Python simulator mirrors the same field names. The API rejects unknown required fields and extra fields that break the current major version.

<table>
<tr>
<td width="8" bgcolor="#006098"></td>
<td>

<strong>Contract.</strong> GIS, edge, and application engineers coordinate on these types, not on each other's internals.

</td>
</tr>
</table>

## Envelope

Every streamed message wraps a payload:

```typescript
interface StreamEnvelope<T> {
  type: "track" | "sensor_telemetry" | "environment" | "device_status" | "alert";
  schema: string; // example: "harborwatch.track/1"
  site_id: string;
  seq?: number;
  sent_at: string;
  payload: T;
}
```

## `TrackUpdate`

```typescript
interface TrackUpdate {
  track_id: string;
  object_type: "vessel" | "vehicle" | "person" | "unknown";
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
```

`track_id` is stable for the life of the object in the scenario (example: `TRK-0027`). `confidence` is 0 to 1. `sensor_id` is the last observer (example: `LIDAR-03`).

## `SensorTelemetry`

```typescript
interface SensorTelemetry {
  sensor_id: string;
  site_id: string;
  status: "operational" | "degraded" | "offline";
  temperature_c: number;
  humidity_percent: number;
  visibility_meters: number;
  wind_speed_mps: number;
  wind_direction: number;
  battery_percent?: number;
  timestamp: string;
}
```

## `EnvironmentalTelemetry`

Site-level weather distinct from a single cabinet:

```typescript
interface EnvironmentalTelemetry {
  site_id: string;
  visibility_meters: number;
  wind_speed_mps: number;
  wind_direction: number;
  temperature_c: number;
  sea_state?: number;
  timestamp: string;
}
```

## `DeviceStatus`

```typescript
interface DeviceStatus {
  device_id: string;
  site_id: string;
  kind: "lidar" | "gateway" | "radio" | "other";
  connected: boolean;
  latitude?: number;
  longitude?: number;
  last_heartbeat: string;
}
```

## `SiteConfiguration`

```typescript
interface SiteConfiguration {
  site_id: string;
  name: string;
  extent: { xmin: number; ymin: number; xmax: number; ymax: number };
  default_camera?: { longitude: number; latitude: number; height: number };
  restricted_zones: Array<{ zone_id: string; name: string; polygon: GeoJsonPolygon }>;
}
```

## `UserSession`

```typescript
interface UserSession {
  user_id: string;
  email: string;
  role: "viewer" | "operator" | "admin";
  site_ids: string[];
}
```

## Versioning

| Rule | Practice |
|---|---|
| Major | Breaking field rename or type change. New `schema` string. |
| Minor | Optional field added. Old clients ignore it. |
| Patch | Docs or constraint clarification only. |

The API may translate `harborwatch.track/1` to `/2` at the edge if a migration is explicit. Clients advertise supported schema versions on subscribe.

Contract tests in CI encode these fixtures. See [testing](./testing.md).

## Related

- [Data flow](./data-flow.md)
- [Decisions](./decisions.md)
- [Root README contracts](../../README.md#core-contracts)
