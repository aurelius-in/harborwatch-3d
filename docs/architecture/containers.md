<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Containers

> Runtime processes: web, API, simulator, database, and streaming sockets.

## Container map

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#E8F8F8",
    "primaryTextColor": "#002C54",
    "lineColor": "#00A0B8"
  }
}}%%
flowchart TB
  subgraph browser["Browser"]
    web["apps/web<br/>React + Vite + SceneView"]
  end
  subgraph app["Application host"]
    api["apps/api<br/>Node.js + TypeScript"]
    ws["WebSocket gateway<br/>/ws/tracks /ws/telemetry /ws/status"]
  end
  subgraph edge["Edge host"]
    sim["services/edge-simulator<br/>Python + AsyncIO"]
  end
  db["PostgreSQL"]
  arc["ArcGIS Maps SDK"]

  sim -->|"normalized events"| api
  web -->|"REST"| api
  web -->|"subscribe"| ws
  api --- ws
  api --> db
  web --> arc

  style web fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style api fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style ws fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style sim fill:#006098,stroke:#002C54,color:#FFFFFF
  style db fill:#08345C,stroke:#ACE0E8,color:#FFFFFF
  style arc fill:#ACE0E8,stroke:#006098,color:#002C54
  style browser fill:#E8F8F8,stroke:#00A0B8,color:#002C54
  style app fill:#E8F8F8,stroke:#002C54,color:#002C54
  style edge fill:#E8F8F8,stroke:#006098,color:#002C54
```

## `apps/web`

| Item | Choice |
|---|---|
| Runtime | Browser (PWA) |
| Stack | React, TypeScript, Vite |
| GIS | ArcGIS Maps SDK `SceneView` when an API key is set; built-in 3D harbor scene otherwise |
| Talks to | REST on `apps/api`, WebSockets, optional ArcGIS |

Responsibilities: layout (desktop sidebar, tablet drawer, phone sheet), layer toggles, track inspector, reconnect banner, RBAC-aware chrome, offline-capable shell.

Local port: `http://localhost:3000`.

## `apps/api`

| Item | Choice |
|---|---|
| Runtime | Node.js |
| Stack | TypeScript, HTTP + WebSocket |
| Talks to | Simulator ingest, PostgreSQL, web clients |

Responsibilities: authentication, RBAC, site-scoped subscriptions, normalized contracts, historical queries, WebSocket lifecycle, structured logs, `/api/health`.

REST surface:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Local identity adapter |
| GET | `/api/sites` | Sites the user may see |
| GET | `/api/sensors` | Sensor roster and health snapshot |
| GET | `/api/devices` | Device GPS and heartbeat |
| GET | `/api/tracks` | Snapshot of the live board |
| GET | `/api/tracks/:id/history` | Bounded historical points (operator+) |
| GET | `/api/alerts` | In-app alerts |
| POST | `/api/alerts/:id/ack` | Acknowledge (operator+) |
| GET | `/api/user` | Current session and role |
| GET | `/api/health` | Liveness and dependency flags |
| POST | `/api/ingest` | Simulator or edge service ingest |

WebSocket surface:

| Path | Payload |
|---|---|
| `/ws/tracks` | `TrackUpdate` stream |
| `/ws/telemetry` | Sensor and environmental telemetry |
| `/ws/status` | Connection, device, and alert status |

Local port: `http://localhost:5000`.

## `services/edge-simulator`

| Item | Choice |
|---|---|
| Runtime | Python 3.9+ |
| Stack | AsyncIO, WebSocket or HTTP client |
| Talks to | `apps/api` ingest only |

It pretends to be the edge and streaming team's process. It emits object tracks, sensor health, GPS/device position, temperature, wind, visibility, and connection status.

<table>
<tr>
<td width="8" bgcolor="#00A0B8"></td>
<td>

<strong>Note.</strong> The simulator is a separate service on purpose. In a real architecture that boundary is owned by another engineering discipline.

</td>
</tr>
</table>

Local port: `http://localhost:8000`.

## PostgreSQL

Stores users, site configuration, sensor registry, and historical track samples. Live motion does not round-trip the database on every tick. History writes are batched or sampled so the socket path stays hot.

## Streaming

The API owns the fan-out. The client track store binds `/ws/tracks`. ArcGIS SceneView upserts graphics when a key is present. StreamLayer is a future GIS-team bind, not mounted here. See [realtime streaming](./realtime-streaming.md).

## Related

- [Components](./components.md)
- [Deployment](./deployment.md)
- [Diagrams: deployment](../diagrams/deployment.md)
