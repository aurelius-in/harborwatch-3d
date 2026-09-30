<p align="center">
  <img src="./hw3d-logo-loop.gif" alt="HarborWatch 3D" width="320" />
</p>

<h1 align="center">HarborWatch 3D</h1>

<p align="center">
  <strong>Real-time sensor fusion for a harbor operations console</strong>
</p>

<p align="center">
  <img alt="navy" src="https://img.shields.io/badge/navy-%23002C54.svg?style=flat-square&labelColor=002C54&color=002C54" />
  <img alt="sea" src="https://img.shields.io/badge/sea-%23006098.svg?style=flat-square&labelColor=006098&color=006098" />
  <img alt="teal" src="https://img.shields.io/badge/teal-%2300A0B8.svg?style=flat-square&labelColor=00A0B8&color=00A0B8" />
  <img alt="beam" src="https://img.shields.io/badge/beam-%23ACE0E8.svg?style=flat-square&labelColor=ACE0E8&color=ACE0E8" />
</p>

<p align="center">
  <a href="https://github.com/aurelius-in/harborwatch-3d/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/aurelius-in/harborwatch-3d/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-002C54?style=flat-square" />
</p>

HarborWatch 3D is a public reference implementation of a **secure, account-based operations console**. Edge sensors emit normalized object tracks. A streaming gateway authenticates operators, fans those tracks out over WebSockets, and a React console draws them in 3D with sensor health, weather, alerts, and history.

The product is the integration layer: contracts, ingest, RBAC, live sockets, and the board. Detection, SLAM, and point-cloud processing stay with the edge team. GIS internals stay with the GIS team.

<table>
<tr>
<td width="8" bgcolor="#00A0B8"></td>
<td>

<strong>Scope.</strong> Simulated LiDAR-derived tracks on a fictional site (Alder Harbor). This repository does not represent a government, defense, or proprietary program.

</td>
</tr>
</table>

## Run it

```bash
git clone https://github.com/aurelius-in/harborwatch-3d.git
cd harborwatch-3d
cp .env.example .env
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

| Process | URL |
|---|---|
| Console | http://localhost:3000 |
| API | http://localhost:5000 |
| Simulator health | http://localhost:8000/health |

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Viewer | `viewer@harborwatch.local` | `viewer` |
| Operator | `operator@harborwatch.local` | `operator` |
| Admin | `admin@harborwatch.local` | `admin` |

Viewer is read-only. Operator can acknowledge alerts and query track history. Admin includes configuration and audit writes.

### Without Docker

```bash
npm install
pip install -r services/edge-simulator/requirements.txt
# API defaults to in-memory storage when DATABASE_URL is unset or memory://
npm run dev
```

In a second terminal:

```bash
npm run dev:sim
```

Set `VITE_ARCGIS_API_KEY` (and `ARCGIS_API_KEY`) to bind ArcGIS SceneView. With no key, the console uses the built-in 3D harbor scene so the demo is never an empty map.

## What you should see

- 20 to 100 movers classified as vessel, vehicle, person, or unknown
- Trails, click-to-inspect (id, class, speed, heading, confidence, last update, sensor)
- Left and right ops panels: sensors, environment, connection, tracks, alerts
- Layer toggles: Object Tracks, Track History, Sensors, Environmental Data, Restricted Zones, Device Locations
- Desktop sidebar, tablet drawer, phone bottom sheet
- Live reconnect when the socket drops

## Architecture

```text
LiDAR / edge hardware
        |
Detection and tracking
        |
Normalized TrackUpdate events
        |
Python edge simulator  ->  Node streaming gateway  ->  WebSocket
                                                       |
                                                     React PWA
                                                       |
                                      ArcGIS SceneView or 3D harbor fallback
```

| Package | Role |
|---|---|
| `apps/web` | React 18, TypeScript, Vite, PWA, 3D console |
| `apps/api` | Node.js, Express, WebSockets, JWT, PostgreSQL |
| `services/edge-simulator` | Python AsyncIO producer (separate process on purpose) |
| `packages/contracts` | Shared schemas (`TrackUpdate`, telemetry, session) |
| `packages/auth` | Local JWT adapter, OIDC-ready helpers |
| `packages/telemetry` | Structured JSON logs and in-process metrics |

REST: `GET /api/sites`, `/api/sensors`, `/api/tracks/:id/history`, `/api/user`, `/api/health`.  
Sockets: `/ws/tracks`, `/ws/telemetry`, `/ws/status`.

## Design rules

- Stable `track_id` values. The map updates a track. It does not spawn a new object every tick.
- WebSockets for live motion. REST for session, config, and sampled history.
- Sequence numbers win over wall clocks.
- Stale at 15 s, expire at 45 s. History remains queryable.
- The API is the authorization boundary. The UI only reflects it.

## Palette

From [`hw3d-logo.png`](./hw3d-logo.png). No gold. Animated mark: [`hw3d-logo-loop.gif`](./hw3d-logo-loop.gif).

| Token | Hex | Use |
|---|---|---|
| Navy | `#002C54` | Wordmark, chrome, application core |
| Sea | `#006098` | Edge, sensors, secondary fills |
| Teal | `#00A0B8` | Live accent (the 3D) |
| Beam | `#ACE0E8` | Highlights, contract nodes |
| Mist | `#E8F8F8` | Light docs and diagram fill |
| Deep navy | `#002850` | Night panels |

## Documentation

- [Documentation index](./docs/README.md)
- [Architecture overview](./docs/architecture/overview.md)
- [Contracts](./docs/architecture/contracts.md)
- [Realtime streaming](./docs/architecture/realtime-streaming.md)
- [Security](./docs/architecture/security.md)
- [Deployment](./docs/architecture/deployment.md)

## Tests and CI

```bash
npm test
npm run typecheck
npm run build
```

GitHub Actions runs typecheck, unit/contract tests, Python contract tests, and the web build on every push to `main`.

## License

MIT. See [LICENSE](./LICENSE).
