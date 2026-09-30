<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Scalability

> Performance targets and how the system grows.

## Demo targets

| Measure | Target |
|---|---|
| Active tracks per site | 20 to 100 (demo), 500 design headroom |
| Track update rate | 1 to 5 Hz each, coalesced on the broker |
| Concurrent browsers per site | 25 local, 200 design |
| Inspector open latency | Under 100 ms after click |
| Scene usable on phone | 30 fps with history layer off |

These are engineering goals for the reference implementation, not a contractual SLA.

## Scale levers

| Pressure | First lever |
|---|---|
| More tracks | Throttle ingest, expire stale tracks, hide trails on phone |
| More sites | Partition the in-memory board by `site_id` |
| More browsers | Horizontal API + a pub/sub (Redis) for fan-out |
| History growth | Sample, TTL, and partition by day |
| Heavy 3D | Hide trails on small viewports, lower update-rate |

## Process model

A single API process holds the live board in memory. That is enough for the harbor demo. When a second replica is added, ingest must publish to a shared bus so every replica can fan out to its own sockets. Until that bus exists, WebSocket replicas need sticky ingest on one writer.

<table>
<tr>
<td width="8" bgcolor="#00A0B8"></td>
<td>

<strong>Note.</strong> Do not put every track tick in PostgreSQL. Memory is the live board. The database is configuration and sampled history.

</td>
</tr>
</table>

## Client budget

Phones get the same contracts and a smaller presentation. Default phone layers: Object Tracks and Sensors on, Track History off, Environmental Data off. The API can still send full telemetry. The scene simply does not draw it.

## Related

- [Realtime streaming](./realtime-streaming.md)
- [Observability](./observability.md)
- [Testing](./testing.md)
