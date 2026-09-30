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

Compose starts `apps/web`, `apps/api`, `services/edge-simulator`, and PostgreSQL. The web build reads the ArcGIS key from the env file.

## Configuration

| Variable | Consumer | Purpose |
|---|---|---|
| `ARCGIS_API_KEY` | web | Maps SDK |
| `DATABASE_URL` | api | PostgreSQL |
| `AUTH_ISSUER` | api | OIDC |
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

GitHub Actions under `.github/workflows/` is the intended home. Production deploy is gated on a human approval, not a push to `main` alone.

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
