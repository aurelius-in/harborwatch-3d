<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Deployment

> Local, development, staging, and production.

## Environments

| Name | Who | Data | Identity |
|---|---|---|---|
| Local | Developer laptop | Simulator only | Dev users |
| Development | Shared cloud (optional) | Simulator | Dev IdP or shared users |
| Staging | Reviewers | Simulator, prod-like config | Staging OIDC |
| Production | Operators | Real edge ingest when integrated | Production OIDC |

All hosted environments use HTTPS. Local may use HTTP on localhost.

## Local

```bash
git clone https://github.com/aurelius-in/harborwatch-3d.git
cd harborwatch-3d
cp .env.example .env
docker compose up
```

Expected endpoints:

| Process | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:5000 |
| Edge simulator | http://localhost:8000 |

Compose starts `apps/web`, `apps/api`, `services/edge-simulator`, and PostgreSQL.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Viewer | viewer@harborwatch.local | viewer |
| Operator | operator@harborwatch.local | operator |
| Admin | admin@harborwatch.local | admin |

### Without Docker

```bash
npm install
pip install -r services/edge-simulator/requirements.txt
npm run dev
```

Second terminal: `npm run dev:sim`. The API uses in-memory storage when `DATABASE_URL` is unset or starts with `memory://`.

The web build reads `VITE_ARCGIS_API_KEY` when present. Without it, the 3D harbor fallback still shows live tracks.

## Configuration

| Variable | Consumer | Purpose |
|---|---|---|
| `ARCGIS_API_KEY` | web | Maps SDK |
| `DATABASE_URL` | api | PostgreSQL |
| `AUTH_ISSUER` | (unused) | Placeholder for a future OIDC adapter |
| `INGEST_KEY` | api, simulator | Service auth |
| `STALE_MS` / `EXPIRE_MS` | api | Track lifetime |
| `SITE_IDS` | simulator | Scenario selection |

## CI/CD

```text
PR
 ↓
lint
 ↓
unit tests
 ↓
integration tests
 ↓
frontend build
 ↓
Docker build
 ↓
security scan
 ↓
staging deployment
 ↓
smoke test
 ↓
production approval
```

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, unit/contract tests, Python contract tests, the web build, and Playwright on every push to `main`. Hosted deploy remains gated on a human approval.

## Cloud shape

A typical hosted layout:

- Static or Node-hosted SPA behind a CDN
- API as a container with two replicas
- Sticky or shared pub/sub if WebSocket fan-out spans replicas (see [scalability](./scalability.md))
- Managed PostgreSQL
- Simulator as a separate worker (never on the public edge)

Pictures: [diagrams/deployment.md](../diagrams/deployment.md).

## Related

- [Observability](./observability.md)
- [Security](./security.md)
- [Testing](./testing.md)
