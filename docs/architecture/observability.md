<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Observability

> Logging, metrics, health checks, tracing, and alerting.

Operators need to know if the board is live. Developers need to know if ingest, sockets, or GIS tokens failed. HarborWatch separates those concerns.

## Logging

The API and simulator emit structured JSON logs via `packages/telemetry`.

| Field | Meaning |
|---|---|
| `ts` | UTC timestamp |
| `level` | debug, info, warn, error |
| `service` | `api`, `edge-simulator`, `web` (client errors only) |
| `event` | Stable name (`track.ingest`, `ws.subscribe`, `auth.deny`) |
| `site_id` | When known |
| `track_id` | When known, never PII |
| `seq` | When known |
| `request_id` | REST correlation |

Do not log access tokens, ArcGIS keys, or raw passwords. Do not log full track payloads at info in production (cardinality).

## Metrics

| Metric | Type | Use |
|---|---|---|
| `hw_tracks_ingest_total` | counter | Ingest volume |
| `hw_tracks_dropped_total` | counter | Validation or throttle drops |
| `hw_ws_clients` | gauge | Connected browsers per site |
| `hw_track_board_size` | gauge | Active tracks in memory |
| `hw_ingest_lag_ms_count` / `_sum` | counter | Event time vs receive time |
| `hw_ws_send_errors_total` | counter | Fan-out failures |

The web app can expose a debug overlay for Admin: last socket timestamp, board size, and SceneView frame time.

## Health

`GET /api/health` returns:

```json
{
  "status": "ok",
  "api": "ok",
  "database": "ok",
  "ingest_age_s": 1.4,
  "ws_clients": 3
}
```

`status` is `degraded` when ingest is stale or the database is down but the process still serves a last-known board. `status` is `error` when the process should be taken out of rotation.

The simulator exposes `GET /health` on port 8000.

## Tracing

REST requests carry `X-Request-Id`. WebSocket frames do not get a span per track tick (too hot). Subscribe, snapshot, and ingest-batch operations may create spans when OpenTelemetry is enabled.

## Alerting (hosted)

| Condition | Severity | Who |
|---|---|---|
| Ingest age above 30 s | warning | Operator banner + on-call |
| Ingest age above 2 min | critical | On-call |
| Health error | critical | On-call |
| Error log burst | warning | Developers |

In-app alerts (restricted zone, sensor offline) are product features, not the same as SRE alerts. They appear on the teal accent list in the console.

## Related

- [Security](./security.md)
- [Scalability](./scalability.md)
- [Deployment](./deployment.md)
