<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Testing

> Unit, integration, contract, E2E, and load.

## Layers

| Layer | Where | Proves |
|---|---|---|
| Unit | `apps/*`, `packages/*`, `services/edge-simulator` | Pure functions: RBAC, stale expiry, seq discard |
| Contract | `packages/contracts`, `tests/integration` | Fixture JSON parses on Node and Python |
| Integration | `tests/integration` | Ingest to socket to in-memory board |
| E2E | `tests/e2e` | Login, see tracks, open inspector, toggle layer |
| Load | Optional k6 or locust | Fan-out under 200 clients / 200 tracks |

## Contract tests

Golden files live next to the schemas. A change that renames `speed_mps` fails both the TypeScript compile and the Python validator. That is the point of `packages/contracts`.

## Integration

Docker Compose test profile starts API, simulator, and Postgres. A test client:

1. Authenticates as Operator.
2. Subscribes to `/ws/tracks`.
3. Waits for a `TrackUpdate` with a known `track_id` prefix.
4. Calls `GET /api/tracks/:id/history` after a short sample window.

## E2E

Playwright (planned) drives the Vite preview:

- Desktop: sidebar visible, click track, inspector shows heading and sensor.
- Phone viewport: bottom sheet, large toggles.
- Reconnect: stop API briefly, badge appears, tracks resume.

GIS tokens in CI use a restricted key or a mocked SceneView when ArcGIS cannot run.

## Load

A load script publishes synthetic `TrackUpdate` events through ingest (not through the public web). Success is defined as p95 socket latency and a board size that matches active IDs after expire.

## What we do not test here

Raw LiDAR algorithms, classified data handling, and vendor-specific StreamLayer bugs in ArcGIS itself. We test our adapters and contracts.

## Related

- [Contracts](./contracts.md)
- [Deployment](./deployment.md)
- [Decisions](./decisions.md)
