import type {
  AlertEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
  SensorTelemetry,
  StreamEnvelope,
  TrackExpirePayload,
  TrackUpdate,
} from "@harborwatch/contracts";
import { parseTrackUpdate, SCHEMA } from "@harborwatch/contracts";
import { gauge, inc, observe } from "@harborwatch/telemetry";
import type { AppContext } from "./context.ts";
import { getSite, knownSite, pointInPolygon } from "./site.ts";
import { broadcast } from "./ws.ts";

const HISTORY_SAMPLE_MS = 2000;
const TRACK_THROTTLE_MS = 80;
const VISIBILITY_ALERT_M = 2500;

export async function handleIngest(
  ctx: AppContext,
  body: unknown,
): Promise<{ accepted: boolean; reason?: string }> {
  if (!body || typeof body !== "object") {
    inc("hw_tracks_dropped_total");
    return { accepted: false, reason: "invalid envelope" };
  }
  const envelope = body as StreamEnvelope<unknown>;
  if (!envelope.type || !envelope.site_id || !envelope.payload) {
    inc("hw_tracks_dropped_total");
    return { accepted: false, reason: "missing envelope fields" };
  }
  if (!knownSite(envelope.site_id)) {
    inc("hw_tracks_dropped_total");
    return { accepted: false, reason: "unknown site" };
  }
  ctx.lastIngestAt = Date.now();
  ctx.lastIngestBySite.set(envelope.site_id, Date.now());

  if (envelope.type === "track") {
    return ingestTrack(ctx, envelope);
  }
  if (envelope.type === "sensor_telemetry") {
    const payload = envelope.payload as SensorTelemetry;
    ctx.sensors.set(payload.sensor_id, payload);
    if (payload.status === "offline") {
      await raiseAlert(ctx, {
        alert_id: `sensor-offline-${payload.sensor_id}`,
        site_id: envelope.site_id,
        kind: "sensor_offline",
        severity: "warning",
        message: `${payload.sensor_id} is offline`,
        sensor_id: payload.sensor_id,
        acknowledged: false,
        created_at: new Date().toISOString(),
      });
    } else if (payload.status === "degraded") {
      await raiseAlert(ctx, {
        alert_id: `sensor-stale-${payload.sensor_id}`,
        site_id: envelope.site_id,
        kind: "stale_sensor",
        severity: "warning",
        message: `${payload.sensor_id} is degraded`,
        sensor_id: payload.sensor_id,
        acknowledged: false,
        created_at: new Date().toISOString(),
      });
    }
    broadcast(ctx, "telemetry", envelope, envelope.site_id);
    return { accepted: true };
  }
  if (envelope.type === "environment") {
    const payload = envelope.payload as EnvironmentalTelemetry;
    ctx.environments.set(envelope.site_id, payload);
    if (payload.visibility_meters < VISIBILITY_ALERT_M) {
      await raiseAlert(ctx, {
        alert_id: `low-vis-${envelope.site_id}`,
        site_id: envelope.site_id,
        kind: "low_visibility",
        severity: "warning",
        message: `Visibility ${Math.round(payload.visibility_meters)} m at ${envelope.site_id}`,
        acknowledged: false,
        created_at: new Date().toISOString(),
      });
    }
    broadcast(ctx, "telemetry", envelope, envelope.site_id);
    return { accepted: true };
  }
  if (envelope.type === "device_status") {
    const payload = envelope.payload as DeviceStatus;
    ctx.devices.set(payload.device_id, payload);
    broadcast(ctx, "status", envelope, envelope.site_id);
    return { accepted: true };
  }
  inc("hw_tracks_dropped_total");
  return { accepted: false, reason: "unknown type" };
}

async function ingestTrack(
  ctx: AppContext,
  envelope: StreamEnvelope<unknown>,
): Promise<{ accepted: boolean; reason?: string }> {
  let update: TrackUpdate;
  try {
    update = parseTrackUpdate(envelope.payload);
  } catch (err) {
    inc("hw_tracks_dropped_total");
    ctx.logger.warn({
      event: "track.ingest.reject",
      service: "api",
      reason: err instanceof Error ? err.message : "invalid",
    });
    return { accepted: false, reason: "invalid TrackUpdate" };
  }
  const throttleKey = `${envelope.site_id}:${update.track_id}`;
  const lastWrite = ctx.lastTrackWrite.get(throttleKey) ?? 0;
  if (Date.now() - lastWrite < TRACK_THROTTLE_MS) {
    inc("hw_tracks_dropped_total");
    return { accepted: false, reason: "throttled" };
  }
  const record = ctx.board.apply(envelope.site_id, update, envelope.seq);
  if (!record) {
    inc("hw_tracks_dropped_total");
    return { accepted: false, reason: "stale seq" };
  }
  ctx.lastTrackWrite.set(throttleKey, Date.now());
  inc("hw_tracks_ingest_total");
  gauge("hw_track_board_size", ctx.board.size());
  const eventTime = Date.parse(update.timestamp);
  if (Number.isFinite(eventTime)) {
    observe("hw_ingest_lag_ms", Math.max(0, Date.now() - eventTime));
  }
  const out: StreamEnvelope<TrackUpdate> = {
    type: "track",
    schema: SCHEMA.track,
    site_id: envelope.site_id,
    seq: record.seq,
    sent_at: new Date().toISOString(),
    payload: record,
  };
  broadcast(ctx, "tracks", out, envelope.site_id);

  const last = ctx.lastHistoryWrite.get(throttleKey) ?? 0;
  if (Date.now() - last >= HISTORY_SAMPLE_MS) {
    ctx.lastHistoryWrite.set(throttleKey, Date.now());
    await ctx.store.insertHistory({
      track_id: update.track_id,
      site_id: envelope.site_id,
      latitude: update.latitude,
      longitude: update.longitude,
      speed_mps: update.speed_mps,
      heading: update.heading,
      timestamp: update.timestamp,
    });
  }

  const site = getSite(envelope.site_id);
  for (const zone of site?.restricted_zones ?? []) {
    if (pointInPolygon(update.longitude, update.latitude, zone.polygon.coordinates)) {
      await raiseAlert(ctx, {
        alert_id: `zone-${zone.zone_id}-${update.track_id}`,
        site_id: envelope.site_id,
        kind: "restricted_zone",
        severity: "critical",
        message: `${update.track_id} entered ${zone.name}`,
        track_id: update.track_id,
        acknowledged: false,
        created_at: new Date().toISOString(),
      });
    }
  }
  if (update.object_type === "unknown" && update.confidence < 0.45) {
    await raiseAlert(ctx, {
      alert_id: `unknown-${update.track_id}`,
      site_id: envelope.site_id,
      kind: "unknown_contact",
      severity: "info",
      message: `Low-confidence unknown contact ${update.track_id}`,
      track_id: update.track_id,
      acknowledged: false,
      created_at: new Date().toISOString(),
    });
  }
  return { accepted: true };
}

export async function raiseAlert(ctx: AppContext, alert: AlertEvent): Promise<void> {
  await ctx.store.upsertAlert(alert);
  const envelope: StreamEnvelope<AlertEvent> = {
    type: "alert",
    schema: SCHEMA.alert,
    site_id: alert.site_id,
    sent_at: new Date().toISOString(),
    payload: alert,
  };
  broadcast(ctx, "status", envelope, alert.site_id);
}

export async function checkOperationalAlerts(ctx: AppContext): Promise<void> {
  const now = Date.now();
  for (const siteId of ctx.board.siteIds()) {
    const last = ctx.lastIngestBySite.get(siteId) ?? ctx.lastIngestAt;
    if (last > 0 && now - last > 30_000) {
      await raiseAlert(ctx, {
        alert_id: `stale-ingest-${siteId}`,
        site_id: siteId,
        kind: "stale_ingest",
        severity: "warning",
        message: `No ingest for ${siteId} in ${Math.round((now - last) / 1000)} s`,
        acknowledged: false,
        created_at: new Date().toISOString(),
      });
    }
  }
  for (const sensor of ctx.sensors.values()) {
    const age = now - Date.parse(sensor.timestamp);
    if (Number.isFinite(age) && age > 20_000) {
      await raiseAlert(ctx, {
        alert_id: `sensor-stale-${sensor.sensor_id}`,
        site_id: sensor.site_id,
        kind: "stale_sensor",
        severity: "warning",
        message: `${sensor.sensor_id} telemetry is ${Math.round(age / 1000)} s old`,
        sensor_id: sensor.sensor_id,
        acknowledged: false,
        created_at: new Date().toISOString(),
      });
    }
  }
}

export function broadcastExpired(ctx: AppContext, siteId: string, trackIds: string[]): void {
  if (!trackIds.length) return;
  const envelope: StreamEnvelope<TrackExpirePayload> = {
    type: "track_expire",
    schema: SCHEMA.track_expire,
    site_id: siteId,
    sent_at: new Date().toISOString(),
    payload: { track_ids: trackIds },
  };
  broadcast(ctx, "status", envelope, siteId);
  broadcast(ctx, "tracks", envelope, siteId);
}
