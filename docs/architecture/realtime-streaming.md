<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Realtime streaming

> WebSocket lifecycle, sequencing, reconnection, throttling, and stale-track handling.

Hundreds of continuously changing objects are a streaming problem, not a polling problem. HarborWatch 3D treats each moving thing as a **track** with a stable ID. The map updates that ID. It does not allocate a new feature on every tick.

<table>
<tr>
<td width="8" bgcolor="#00A0B8"></td>
<td>

<strong>Note.</strong> Esri StreamLayer is the GIS-team contract for a future bind. This demo uses custom WebSockets plus a track store. SceneView graphics are used when an ArcGIS key is present.

</td>
</tr>
</table>

## Endpoints

| Socket | Event | Cadence (demo) |
|---|---|---|
| `/ws/tracks` | `TrackUpdate` | 1 to 5 Hz per track, site aggregate much higher |
| `/ws/telemetry` | Sensor and environment | 0.2 to 1 Hz |
| `/ws/status` | Device and connection | On change, heartbeat 10 s |

Handshake carries a bearer token. The server binds the socket to `user_id`, `role`, and allowed `site_id` values. After open, the client may send `{ "subscribe": ["tracks"], "site_id": "alder-harbor" }` to pin the fan-out to one site.

## Sequencing

Every track event includes:

- `track_id` for identity
- `timestamp` as ISO-8601 UTC
- `seq` as a monotonic integer per track (or per site stream)

The client ignores an update when `seq` is less than or equal to the last applied value for that ID. Clock skew is not used for ordering.

## Reconnection

1. Client shows the reconnect badge (teal pulse on navy) and the backoff delay.
2. Sockets reopen independently (`/ws/tracks`, `/ws/telemetry`, `/ws/status`) with exponential backoff, capped at 20 s.
3. On `/ws/tracks` open, the server sends a snapshot of currently active tracks for the subscribed site, then live diffs.
4. The client discards any `seq` less than or equal to the last applied value for that `track_id`.

The demo does not resume from a client-supplied `since_seq`. Snapshot plus live seq filtering is the reconnect contract.

## Throttling

| Control | Where | Purpose |
|---|---|---|
| Ingest cap | API | Drop updates for a track closer than 80 ms |
| History sample | API | Write a history point at most every 2 s per track |
| Login rate limit | API | 20 attempts per minute per IP |
| Ingest rate limit | API | 400 envelopes per second per IP |

The demo does not coalesce fan-out in a broker window and does not implement viewport subscribe. Site subscribe is implemented.

## Stale tracks

A track is **stale** when no accepted update arrives within `STALE_MS` (default 15 s). A track is **expired** after `EXPIRE_MS` (default 45 s). Stale tracks dim in the inspector. Expired tracks leave the active list and the layer.

History remains queryable after expire. Live presence does not.

## Interpolation

The WebGL harbor interpolates heading and position between updates for smoothness. Interpolation is presentation only. The inspector shows the last **received** speed, heading, and timestamp, not the interpolated pose. ArcGIS graphics snap to the last received point.

## Why this answers "hundreds of objects"

- Track IDs instead of creating new objects
- Incremental attribute updates
- WebSockets instead of polling
- Server and client site filters
- Update throttling
- Bounded history
- Stale-track expiration
- Interpolation for WebGL motion
- Reconnection with snapshot
- Sequence numbers and timestamps
- Subscription by site

Viewport subscribe and StreamLayer purge rules are not part of this repository.

## Related

- [Data flow](./data-flow.md)
- [Geospatial](./geospatial.md)
- [Scalability](./scalability.md)
