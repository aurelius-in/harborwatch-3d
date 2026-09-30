<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Components

> Who owns which piece inside each container, and where the seams are.

## Team seams

```text
               Application Lead
                      |
             shared contracts
              /              \
             /                \
     Edge Engineer          GIS Engineer
          |                      |
    Track/Telemetry          ArcGIS Layers
       Streams              / Components
             \                /
              \              /
                React App
```

<table>
<tr>
<td width="8" bgcolor="#006098"></td>
<td>

<strong>Contract.</strong> Specialists do not need to coordinate implementation internals. They agree on interfaces and schemas in <code>packages/contracts</code>.

</td>
</tr>
</table>

## Web components

| Component | Owns | Does not own |
|---|---|---|
| `SceneShell` | Camera, harbor extent, SceneView or 3D harbor fallback | Track generation |
| `TrackStreamLayer` | Track store, `track_id` grouping, trails, ArcGIS graphics adapter | Auth tokens (receives them) |
| `LayerToggles` | Object Tracks, History, Sensors, Environment, Zones, Devices | Server-side filter policy |
| `TrackInspector` | Selected track fields | Fusion logic |
| `TelemetryPanel` | Sensor and weather cards | Device firmware |
| `AlertList` | Active alerts and ack UI | Paging vendors |
| `ConnectionBadge` | Socket state, reconnect | Simulator process health |
| `RoleGate` | Hide or disable actions by role | Identity issuance |
| `ResponsiveChrome` | Sidebar / drawer / bottom sheet | Separate mobile apps |

## API components

| Component | Owns |
|---|---|
| Auth middleware | Session, JWT or OIDC validation |
| RBAC policy | Viewer / Operator / Admin checks |
| Ingest adapter | Simulator (or future edge) payloads into contracts |
| Track broker | Subscribe by `site_id`, sequence numbers, fan-out |
| History store | Sampled writes and `GET /api/tracks/:id/history` |
| Site registry | Sites, sensors, restricted zones |
| Health | Process, database, ingest freshness |
| Audit log | Config changes and alert acknowledgements |

## Simulator components

| Component | Owns |
|---|---|
| Scenario clock | Harbor geography, 20 to 100 movers |
| Track emitter | `TrackUpdate` with stable `track_id` |
| Telemetry emitter | `SensorTelemetry`, environment, device GPS |
| Health flapper | Occasional degraded or offline sensors (demo) |
| Sink client | Push to API ingest, not to browsers |

## Shared packages

| Package | Role |
|---|---|
| `packages/contracts` | TypeScript (and mirrored Python) schemas |
| `packages/auth` | OIDC adapter, role mapping |
| `packages/telemetry` | Structured log fields and metric names |

## Boundaries that must stay clean

1. Browsers never open a socket to the simulator.
2. GIS code consumes GeoJSON-like attributes from contracts, not ad-hoc JSON.
3. The API may drop or delay updates. Clients must tolerate gaps via sequence and timestamp.
4. Admin-only routes never appear as enabled controls for Viewer.

## Related

- [Contracts](./contracts.md)
- [Geospatial](./geospatial.md)
- [Context](./context.md)
