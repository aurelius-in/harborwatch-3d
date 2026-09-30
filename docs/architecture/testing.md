<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Testing

> Unit, integration, contract, E2E, and load.

## Run

```bash
npm test
npm run typecheck
npm run build
```

`npm test` runs:

1. Golden `TrackUpdate` fixtures in `packages/contracts`
2. API board, RBAC, login, and ingest tests (`apps/api`)
3. `RoleGate` UI tests (`apps/web`)
4. The same fixture parsed in Python (`services/edge-simulator`)

CI is `.github/workflows/ci.yml`.

## Layers

| Layer | Where | Proves |
|---|---|---|
| Unit | `apps/api/src/*.test.ts`, `apps/web` | RBAC, stale expiry, seq discard, RoleGate |
| Contract | `packages/contracts`, `services/edge-simulator` | Fixture JSON parses on Node and Python |
| Integration | `apps/api` HTTP tests | Login, ingest key, live board |
| E2E | Manual / future Playwright | Login, see tracks, open inspector, toggle layer |
| Load | Optional k6 or locust | Fan-out under 200 clients / 200 tracks |

## Contract tests

Golden files live in `packages/contracts/fixtures`. A change that renames `speed_mps` fails both the TypeScript parser and the Python validator. That is the point of `packages/contracts`.

## Integration

The API test harness boots Express against the in-memory store:

1. `POST /api/auth/login` as Viewer and Operator.
2. Viewer is rejected from `POST /api/alerts/:id/ack`.
3. Ingest without `X-Ingest-Key` returns 401.
4. Ingest with the key upserts `TRK-0099` on the site board.

Docker Compose is the full path: API, simulator, Postgres, and the web console.

## Console checks

With the stack up:

- Desktop: sidebar visible, click a track, inspector shows heading and sensor.
- Phone viewport: ops panels become a drawer or sheet, toggles stay large.
- Reconnect: stop the API briefly, the badge switches to reconnect, tracks resume.

GIS tokens in CI are optional. The built-in 3D harbor scene is the default so CI does not need ArcGIS.

## Load

A load script should publish synthetic `TrackUpdate` events through ingest (not through the public web). Success is p95 socket latency and a board size that matches active IDs after expire.

## What we do not test here

Raw LiDAR algorithms and vendor-specific ArcGIS StreamLayer bugs. We test adapters and contracts.

## Related

- [Contracts](./contracts.md)
- [Deployment](./deployment.md)
- [Decisions](./decisions.md)
