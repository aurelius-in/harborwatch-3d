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

<strong>Note.</strong> ArcGIS <code>StreamLayer</code> is built for continuously changing geographic observations, custom WebSockets, track IDs, purge rules, and client update-rate controls.

</td>
</tr>
</table>

## Endpoints

| Socket | Event | Cadence (demo) |
|---|---|---|
| `/ws/tracks` | `TrackUpdate` | 1 to 5 Hz per track, site aggregate much higher |
| `/ws/telemetry` | Sensor and environment | 0.2 to 1 Hz |
| `/ws/status` | Device and connection | On change, heartbeat 10 s |

Handshake carries a bearer token. The server binds the socket to `user_id`, `role`, and allowed `site_id` values. Subscribe messages may narrow object types or a viewport.

## Sequencing

Every track event includes:

- `track_id` for identity
- `timestamp` as ISO-8601 UTC
- `seq` as a monotonic integer per track (or per site stream)

The client ignores an update when `seq` is less than or equal to the last applied value for that ID. Clock skew is not used for ordering.

## Reconnection

1. Client shows the reconnect badge (teal pulse on navy).
2. Socket opens with the last received `seq` (or timestamp if seq unknown).
3. Server may send a short snapshot of currently active tracks, then live diffs.
4. StreamLayer reconnects with the same track IDs so graphics do not flicker as new objects.

If snapshot is large, the server pages it. The client does not block the UI on a full replay.

## Throttling

| Control | Where | Purpose |
|---|---|---|
| Ingest cap | API | Drop or coalesce updates above a per-sensor rate |
| Fan-out coalesce | Broker | Latest position wins inside a 100 ms window |
| StreamLayer update-rate | Client | Keep the scene interactive on phone |
| Viewport subscribe | Client to API | Send only tracks near the camera when the operator opts in |

Purge rules on StreamLayer keep the feature set bounded. HarborWatch also expires tracks server-side.

## Stale tracks

A track is **stale** when no accepted update arrives within `STALE_MS` (default 15 s). A track is **expired** after `EXPIRE_MS` (default 45 s). Stale tracks dim in the inspector. Expired tracks leave the active list and the layer.

History remains queryable after expire. Live presence does not.

## Interpolation

The client may interpolate heading and position between updates for smoothness. Interpolation is presentation only. The inspector shows the last **received** speed, heading, and timestamp, not the interpolated pose.

## Why this answers "hundreds of objects"

- Track IDs instead of creating new objects
- Incremental attribute updates
- WebSockets instead of polling
- Server and client filters
- Update throttling
- Bounded history
- Stale-track expiration
- Interpolation for motion
- Reconnection
- Sequence numbers and timestamps
- Subscription by site and layer

## Related

- [Data flow](./data-flow.md)
- [Geospatial](./geospatial.md)
- [Scalability](./scalability.md)
