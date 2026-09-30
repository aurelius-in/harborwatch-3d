import type {
  AlertEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
  SensorTelemetry,
  StreamEnvelope,
  TrackUpdate,
} from "@harborwatch/contracts";
import { parseTrackUpdate, SCHEMA } from "@harborwatch/contracts";
import { gauge, inc } from "@harborwatch/telemetry";
import type { AppContext } from "./context.ts";
import { pointInPolygon, SITE } from "./site.ts";
import { broadcast } from "./ws.ts";

const HISTORY_SAMPLE_MS = 2000;
const lastHistoryWrite = new Map<string, number>();

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
  ctx.lastIngestAt = Date.now();

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
    }
    broadcast(ctx, "telemetry", envelope, envelope.site_id);
    return { accepted: true };
  }
  if (envelope.type === "environment") {
    ctx.environment = envelope.payload as EnvironmentalTelemetry;
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
  const record = ctx.board.apply(envelope.site_id, update, envelope.seq);
  if (!record) {
    inc("hw_tracks_dropped_total");
    return { accepted: false, reason: "stale seq" };
  }
  inc("hw_tracks_ingest_total");
  gauge("hw_track_board_size", ctx.board.size());
  const out: StreamEnvelope<TrackUpdate> = {
    type: "track",
    schema: SCHEMA.track,
    site_id: envelope.site_id,
    seq: record.seq,
    sent_at: new Date().toISOString(),
    payload: record,
  };
  broadcast(ctx, "tracks", out, envelope.site_id);

  const last = lastHistoryWrite.get(update.track_id) ?? 0;
  if (Date.now() - last >= HISTORY_SAMPLE_MS) {
    lastHistoryWrite.set(update.track_id, Date.now());
    await ctx.store.insertHistory({
      track_id: update.track_id,
      latitude: update.latitude,
      longitude: update.longitude,
      speed_mps: update.speed_mps,
      heading: update.heading,
      timestamp: update.timestamp,
    });
  }

  for (const zone of SITE.restricted_zones) {
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

async function raiseAlert(ctx: AppContext, alert: AlertEvent): Promise<void> {
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
